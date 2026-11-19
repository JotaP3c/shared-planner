package com.sharedplanner.catalog;

import com.sharedplanner.access.Permission;
import com.sharedplanner.audit.AuditAction;
import com.sharedplanner.audit.AuditEntityType;
import com.sharedplanner.audit.AuditService;
import com.sharedplanner.calendar.SharedCalendarRepository;
import com.sharedplanner.config.AuthorizationService;
import com.sharedplanner.user.User;
import com.sharedplanner.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CatalogService {
    private final CatalogItemRepository items;
    private final CatalogPriceChangeRepository history;
    private final SharedCalendarRepository calendars;
    private final UserRepository users;
    private final AuthorizationService authorization;
    private final AuditService audit;

    public CatalogService(CatalogItemRepository items, CatalogPriceChangeRepository history,
                          SharedCalendarRepository calendars, UserRepository users,
                          AuthorizationService authorization, AuditService audit) {
        this.items = items;
        this.history = history;
        this.calendars = calendars;
        this.users = users;
        this.authorization = authorization;
        this.audit = audit;
    }

    public record CatalogPage(List<CatalogItemResponse> items, int page, int size, long totalElements) {}

    public record ScheduledItem(UUID id, String name, BigDecimal standardPrice, BigDecimal effectivePrice,
                                Integer durationMinutes) {}

    @Transactional(readOnly = true)
    public CatalogPage list(UUID calendarId, String q, CatalogItemType type, Boolean active, String category,
                            LocalDate appointmentDate, int page, int size, Authentication actor) {
        ensureCanView(calendarId, actor);
        var result = items.search(calendarId, searchText(q, 180), type, active, searchText(category, 100),
                pageRequest(page, size));
        LocalDate date = appointmentDate == null ? LocalDate.now() : appointmentDate;
        return new CatalogPage(result.getContent().stream().map(item -> CatalogItemResponse.from(item, date)).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public CatalogItemResponse get(UUID calendarId, UUID id, LocalDate appointmentDate, Authentication actor) {
        ensureCanView(calendarId, actor);
        return CatalogItemResponse.from(requireItem(calendarId, id), appointmentDate == null ? LocalDate.now() : appointmentDate);
    }

    @Transactional
    public CatalogItemResponse create(UUID calendarId, CatalogItemRequest request, Authentication actor) {
        ensureCanManage(calendarId, actor);
        var item = items.saveAndFlush(new CatalogItem(calendarId, request, new CatalogPricing(request)));
        User user = currentUser(actor);
        history.save(new CatalogPriceChange(item, user));
        auditItem(item, AuditAction.CREATED, user);
        return CatalogItemResponse.from(item, LocalDate.now());
    }

    @Transactional
    public CatalogItemResponse update(UUID calendarId, UUID id, CatalogItemRequest request, Authentication actor) {
        ensureCanManage(calendarId, actor);
        if (request.version() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catalog item version is required for editing");
        }
        CatalogItem item = items.findForUpdate(calendarId, List.of(id)).stream().findFirst().orElseThrow(CatalogService::notFound);
        if (item.version() != request.version()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Catalog item was updated. Refresh and try again");
        }
        CatalogPricing pricing = new CatalogPricing(request);
        boolean priceChanged = !item.pricing().sameAs(pricing);
        item.update(request, pricing);
        items.flush();
        User user = currentUser(actor);
        if (priceChanged) history.save(new CatalogPriceChange(item, user));
        auditItem(item, AuditAction.UPDATED, user);
        return CatalogItemResponse.from(item, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public List<CatalogPriceChangeResponse> priceHistory(UUID calendarId, UUID id, int page, int size, Authentication actor) {
        ensureCanView(calendarId, actor);
        requireItem(calendarId, id);
        return history.findByCatalogItemIdOrderByChangedAtDescIdDesc(id, pageRequest(page, size)).stream()
                .map(CatalogPriceChangeResponse::from).toList();
    }

    /** The event transaction holds these locks until it saves the contracted snapshot. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Map<UUID, ScheduledItem> lockForEvent(UUID calendarId, Collection<UUID> ids, LocalDate appointmentDate,
                                               Authentication actor) {
        ensureCanView(calendarId, actor);
        Set<UUID> unique = new HashSet<>(ids);
        if (unique.isEmpty()) return Map.of();
        List<CatalogItem> selected = items.findForUpdate(calendarId, unique);
        if (selected.size() != unique.size() || selected.stream().anyMatch(item -> !item.active())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Active catalog item not found");
        }
        Map<UUID, ScheduledItem> locked = new HashMap<>();
        for (CatalogItem item : selected) {
            locked.put(item.id(), new ScheduledItem(item.id(), item.name(), item.pricing().standardPrice(),
                    item.pricing().priceOn(appointmentDate), item.durationMinutes()));
        }
        return Map.copyOf(locked);
    }

    public void ensureCanView(UUID calendarId, Authentication actor) {
        ensureCatalogAccess(calendarId, actor, false);
    }

    private void ensureCanManage(UUID calendarId, Authentication actor) {
        ensureCatalogAccess(calendarId, actor, true);
    }

    private void ensureCatalogAccess(UUID calendarId, Authentication actor, boolean manage) {
        Set<Permission> permissions = authorization.calendarPermissions(calendarId, actor);
        if (!permissions.contains(Permission.FINANCE_VIEW) || !permissions.contains(Permission.CATALOG_VIEW)
                || (manage && !permissions.contains(Permission.CATALOG_MANAGE))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Catalog permission is required");
        }
        if (!calendars.existsById(calendarId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar not found");
        }
    }

    private CatalogItem requireItem(UUID calendarId, UUID id) {
        return items.findByCalendarIdAndId(calendarId, id).orElseThrow(CatalogService::notFound);
    }

    private User currentUser(Authentication actor) {
        return users.findByEmailIgnoreCaseAndActiveTrue(actor.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void auditItem(CatalogItem item, AuditAction action, User actor) {
        // AUDIT_VIEW alone is not financial access. Price snapshots live in the protected history.
        audit.log(AuditEntityType.CATALOG_ITEM, item.id(), item.calendarId(), action,
                item.active() ? "Catalog item saved as active" : "Catalog item saved as inactive", null, null, actor);
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || page > 10_000 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid catalog pagination");
        }
        return PageRequest.of(page, size);
    }

    private static String searchText(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catalog search is too long");
        }
        return text.strip().toLowerCase(Locale.ROOT);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Catalog item not found");
    }
}

package com.sharedplanner.event;

import com.sharedplanner.catalog.CatalogService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EventCatalogPricing {
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("9999999999.99");
    private static final BigDecimal ZERO_AMOUNT = new BigDecimal("0.00");
    private final CatalogService catalog;

    public EventCatalogPricing(CatalogService catalog) {
        this.catalog = catalog;
    }

    @Transactional
    public EventCatalogQuote quote(EventCatalogQuote.Request request, Authentication actor) {
        return price(request.calendarId(), request.appointmentDate(), request.catalogItems(), List.of(), null, actor);
    }

    void ensureCanView(UUID calendarId, Authentication actor) {
        catalog.ensureCanView(calendarId, actor);
    }

    EventCatalogQuote price(UUID calendarId, LocalDate appointmentDate, List<CatalogItemSelection> selections,
                           List<EventCatalogItem> preserved, BigDecimal expectedTotal, Authentication actor) {
        validateSelections(selections);
        Map<UUID, EventCatalogItem> contracted = preserved.stream().collect(Collectors.toMap(
                EventCatalogItem::catalogItemId, Function.identity()));
        List<UUID> toResolve = selections.stream().map(CatalogItemSelection::catalogItemId)
                .filter(id -> !contracted.containsKey(id)).toList();
        Map<UUID, CatalogService.ScheduledItem> activeItems;
        if (toResolve.isEmpty()) {
            ensureCanView(calendarId, actor);
            activeItems = Map.of();
        } else {
            activeItems = catalog.lockForEvent(calendarId, toResolve, appointmentDate, actor);
        }

        List<EventCatalogItem> items = new ArrayList<>(selections.size());
        BigDecimal total = ZERO_AMOUNT;
        for (CatalogItemSelection selection : selections) {
            EventCatalogItem row = contracted.get(selection.catalogItemId());
            row = row == null ? snapshot(activeItems.get(selection.catalogItemId()), selection.quantity())
                    : row.withQuantity(selection.quantity());
            if (row.subtotal().compareTo(MAX_AMOUNT) > 0 || row.discount().compareTo(MAX_AMOUNT) > 0) {
                throw invalid("O subtotal ou desconto ultrapassa o limite permitido.");
            }
            checkExpectedTerms(selection, row);
            total = total.add(row.subtotal());
            items.add(row);
        }
        if (total.compareTo(MAX_AMOUNT) > 0) {
            throw invalid("O total ultrapassa o limite permitido.");
        }
        checkExpectedTotal(expectedTotal, total);
        return new EventCatalogQuote(List.copyOf(items), total);
    }

    private static void checkExpectedTotal(BigDecimal expected, BigDecimal actual) {
        if (differs(expected, actual)) {
            throw changedTerms();
        }
    }

    private static void validateSelections(List<CatalogItemSelection> selections) {
        if (selections == null || selections.isEmpty() || selections.size() > 50) {
            throw invalid("Selecione de 1 a 50 itens do catálogo.");
        }
        Set<UUID> uniqueIds = new HashSet<>();
        for (CatalogItemSelection selection : selections) {
            if (selection == null || selection.catalogItemId() == null || selection.quantity() == null
                    || selection.quantity() < 1 || selection.quantity() > 999) {
                throw invalid("Informe o item do catálogo e a quantidade entre 1 e 999.");
            }
            if (!uniqueIds.add(selection.catalogItemId())) {
                throw invalid("Informe cada item do catálogo uma única vez e ajuste sua quantidade.");
            }
        }
    }

    private static EventCatalogItem snapshot(CatalogService.ScheduledItem item, int quantity) {
        BigDecimal count = BigDecimal.valueOf(quantity);
        BigDecimal discount = item.standardPrice().subtract(item.effectivePrice()).multiply(count);
        return new EventCatalogItem(item.id(), item.name(), quantity, item.effectivePrice(), discount,
                item.effectivePrice().multiply(count), item.durationMinutes());
    }

    private static void checkExpectedTerms(CatalogItemSelection selection, EventCatalogItem row) {
        int duration = row.durationMinutes() == null ? 0 : row.durationMinutes();
        if (differs(selection.expectedUnitPrice(), row.unitPrice())
                || differs(selection.expectedDiscount(), row.discount())
                || selection.expectedDurationMinutes() != null
                   && selection.expectedDurationMinutes() != duration) {
            throw changedTerms();
        }
    }

    private static boolean differs(BigDecimal expected, BigDecimal actual) {
        return expected != null && expected.compareTo(actual) != 0;
    }

    private static ResponseStatusException changedTerms() {
        return new ResponseStatusException(HttpStatus.CONFLICT,
                "As condições do catálogo mudaram. Revise os itens e confirme o valor atualizado.");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}

package com.sharedplanner.holiday;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/holidays")
public class HolidayController {
    private final HolidayService holidayService;

    public HolidayController(HolidayService holidayService) {
        this.holidayService = holidayService;
    }

    @GetMapping
    public HolidayCalendarResponse list(@RequestParam(defaultValue = "BR") String country,
                                        @RequestParam int year) {
        return holidayService.calendar(country, year);
    }
}

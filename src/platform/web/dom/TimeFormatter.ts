/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { ITimeFormatter } from "../../types/types";
import {Clock} from "./Clock";

enum TimeScope {
    Minute = 60 * 1000,
    Day = 24 * 60 * 60 * 1000,
}

export class TimeFormatter implements ITimeFormatter {

    private todayMidnight: Date;
    private relativeDayFormatter: Intl.RelativeTimeFormat;
    private weekdayFormatter: Intl.DateTimeFormat;
    private currentYearFormatter: Intl.DateTimeFormat;
    private otherYearFormatter: Intl.DateTimeFormat;
    private timeFormatter: Intl.DateTimeFormat;

    constructor(private clock: Clock) {
        // don't use the clock time here as the DOM relative formatters don't support setting the reference date anyway
        this.todayMidnight = new Date();
        this.todayMidnight.setHours(0, 0, 0, 0);
        this.relativeDayFormatter = new Intl.RelativeTimeFormat(undefined, {numeric: "auto"});
        this.weekdayFormatter = new Intl.DateTimeFormat(undefined, {weekday: 'long'});
        this.currentYearFormatter = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
        this.otherYearFormatter = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        this.timeFormatter = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit"});
    }
    
    formatTime(date: Date): string {
        return this.timeFormatter.format(date);
    }

    formatMachineReadableDate(date: Date): string {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;    
    }

    formatRelativeDate(date: Date): string {
        let daysDiff = Math.floor((date.getTime() - this.todayMidnight.getTime()) / TimeScope.Day);
        console.log("formatRelativeDate daysDiff", daysDiff, date);
        if (daysDiff >= -1 && daysDiff <= 1) {
            // Tomorrow, Today, Yesterday
            return capitalizeFirstLetter(this.relativeDayFormatter.format(daysDiff, "day"));
        } else if (daysDiff > -7 && daysDiff < 0) {
            // Wednesday
            return this.weekdayFormatter.format(date);
        } else if (this.todayMidnight.getFullYear() === date.getFullYear()) {
            // Friday, November 6
            return this.currentYearFormatter.format(date);
        } else {
            // Friday, November 5, 2021
            return this.otherYearFormatter.format(date);
        }
    }
}

function capitalizeFirstLetter(str: string) {
    return str.slice(0, 1).toLocaleUpperCase() + str.slice(1);
}
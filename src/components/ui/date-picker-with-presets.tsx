
"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DatePickerWithPresetsProps extends React.HTMLAttributes<HTMLDivElement> {
  date: Date | null | undefined;
  setDate: (date: Date | null | undefined) => void;
}

export const DatePickerWithPresets = React.forwardRef<HTMLDivElement, DatePickerWithPresetsProps>(
  ({ date, setDate, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("grid gap-2", className)}
        {...props}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
            <Select
              onValueChange={(value) => {
                const today = new Date();
                let newDate: Date | undefined;
                switch (value) {
                  case "0": newDate = today; break; // Today
                  case "1": newDate = addDays(today, 1); break; // Tomorrow
                  case "3": newDate = addDays(today, 3); break;
                  case "7": newDate = addDays(today, 7); break;
                  case "30": newDate = addDays(today, 30); break;
                  case "90": newDate = addDays(today, 90); break;
                  case "clear": newDate = undefined; break; // Clear selection
                }
                setDate(newDate);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="0">Today</SelectItem>
                <SelectItem value="1">Tomorrow</SelectItem>
                <SelectItem value="3">In 3 days</SelectItem>
                <SelectItem value="7">In a week</SelectItem>
                <SelectItem value="30">In 30 days</SelectItem>
                <SelectItem value="90">In 90 days</SelectItem>
                <SelectItem value="clear">Clear</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border">
              <Calendar
                mode="single"
                selected={date || undefined} // Pass undefined if date is null
                onSelect={setDate}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
);
DatePickerWithPresets.displayName = "DatePickerWithPresets";

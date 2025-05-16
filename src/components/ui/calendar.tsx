"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import ReactDatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof ReactDatePicker>

function Calendar({
  className,
  ...props
}: CalendarProps) {
  return (
    <div className={className}>
      <ReactDatePicker
        // Pass all props to the date picker
        {...props}
        className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        calendarClassName="bg-background text-foreground"
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

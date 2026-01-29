"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Option {
    value: string
    label: string
}

interface SearchableSelectProps {
    options: Option[]
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
    className?: string
    emptyMessage?: string
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    className,
    emptyMessage = "No option found.",
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false)

    const selectedOption = options.find((option) => option.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-card border-border text-foreground rounded-xl py-4 h-9 px-3 font-normal",
                        className
                    )}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border-white/10" align="start">
                <Command className="bg-transparent text-slate-300">
                    <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="border-none focus:ring-0 text-slate-300" />
                    <CommandList>
                        <CommandEmpty className="py-6 text-center text-sm text-slate-400">{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value)
                                        setOpen(false)
                                    }}
                                    className="text-slate-300 aria-selected:bg-white/10 aria-selected:text-white cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

"use client";

import { Combobox } from "@headlessui/react";
import {
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import { useState } from "react";

export interface SelectOption {
  id: string | number;
  name: string;
}

interface SearchableSelectProps {
  label: string;
  options: SelectOption[];
  value: SelectOption | null;
  onChange: (value: SelectOption | null) => void;
  onAdd?: () => void;
  placeholder?: string;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  onAdd,
  placeholder = "Select...",
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions =
    query === ""
      ? options
      : options.filter((option) =>
          option.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <div className="w-full">
      <label className="block text-sm font-medium leading-6 text-gray-900 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <Combobox as="div" value={value} onChange={onChange}>
            <div className="relative mt-1">
              <Combobox.Input
                className="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                onChange={(event) => setQuery(event.target.value)}
                displayValue={(option: SelectOption) => option?.name}
                placeholder={placeholder}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </Combobox.Button>

              {filteredOptions.length > 0 && (
                <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {filteredOptions.map((option) => (
                    <Combobox.Option
                      key={option.id}
                      value={option}
                      className={({ active }) =>
                        classNames(
                          "relative cursor-default select-none py-2 pl-3 pr-9",
                          active ? "bg-blue-600 text-white" : "text-gray-900",
                        )
                      }
                    >
                      {({ active, selected }) => (
                        <>
                          <span
                            className={classNames(
                              "block truncate",
                              selected ? "font-semibold" : "font-normal",
                            )}
                          >
                            {option.name}
                          </span>
                          {selected && (
                            <span
                              className={classNames(
                                "absolute inset-y-0 right-0 flex items-center pr-4",
                                active ? "text-white" : "text-blue-600",
                              )}
                            >
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                </Combobox.Options>
              )}
            </div>
          </Combobox>
        </div>
        {onAdd && (
          <li
            className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-blue-600 hover:text-white"
            onClick={() => {
              onAdd();
              setIsOpen(false);
            }}
          >
            <div className="flex items-center">
              <PlusIcon
                className="mr-2 h-5 w-5 text-gray-400 group-hover:text-white"
                aria-hidden="true"
              />
            </div>
          </li>
        )}
      </div>
    </div>
  );
}

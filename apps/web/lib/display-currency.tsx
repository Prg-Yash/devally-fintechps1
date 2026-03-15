"use client";

import { useEffect, useState } from "react";

export type DisplayCurrency = "INR" | "USD" | "EUR" | "GBP" | "AED";

export const DISPLAY_CURRENCY_STORAGE_KEY = "paycrow.displayCurrency";
export const DISPLAY_CURRENCY_CHANGE_EVENT = "paycrow:display-currency-changed";

const INR_TO_CURRENCY_RATE: Record<DisplayCurrency, number> = {
	INR: 1,
	USD: 0.012,
	EUR: 0.011,
	GBP: 0.0095,
	AED: 0.044,
};

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
	return value === "INR" || value === "USD" || value === "EUR" || value === "GBP" || value === "AED";
}

export function getStoredDisplayCurrency(defaultCurrency: DisplayCurrency = "INR"): DisplayCurrency {
	if (typeof window === "undefined") return defaultCurrency;
	const stored = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
	return isDisplayCurrency(stored) ? stored : defaultCurrency;
}

export function setStoredDisplayCurrency(currency: DisplayCurrency) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, currency);
	window.dispatchEvent(new CustomEvent(DISPLAY_CURRENCY_CHANGE_EVENT, { detail: currency }));
}

export function convertInrToCurrency(amountInr: number, currency: DisplayCurrency) {
	const numeric = Number.isFinite(amountInr) ? amountInr : 0;
	return numeric * (INR_TO_CURRENCY_RATE[currency] || 1);
}

export function convertCurrencyToInr(amount: number, currency: DisplayCurrency) {
	const numeric = Number.isFinite(amount) ? amount : 0;
	const rate = INR_TO_CURRENCY_RATE[currency] || 1;
	return numeric / rate;
}

export function formatDisplayCurrency(amountInr: number, currency: DisplayCurrency) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(convertInrToCurrency(amountInr, currency));
}

export function useDisplayCurrencyPreference(defaultCurrency: DisplayCurrency = "INR") {
	const [currency, setCurrency] = useState<DisplayCurrency>(defaultCurrency);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const sync = () => setCurrency(getStoredDisplayCurrency(defaultCurrency));
		sync();

		const onStorage = (event: StorageEvent) => {
			if (event.key === DISPLAY_CURRENCY_STORAGE_KEY) {
				sync();
			}
		};

		const onInternalChange = () => sync();

		window.addEventListener("storage", onStorage);
		window.addEventListener(DISPLAY_CURRENCY_CHANGE_EVENT, onInternalChange);

		return () => {
			window.removeEventListener("storage", onStorage);
			window.removeEventListener(DISPLAY_CURRENCY_CHANGE_EVENT, onInternalChange);
		};
	}, [defaultCurrency]);

	return currency;
}

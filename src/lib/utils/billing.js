export const INVOICE_TONE = { unpaid: "yellow", partial: "blue", paid: "green", void: "gray" };
export const INVOICE_LABEL = { unpaid: "Unpaid", partial: "Partially paid", paid: "Paid", void: "Void" };
export const METHOD_LABEL = { cash: "Cash", gcash: "GCash", card: "Card", bank_transfer: "Bank transfer" };


export const balanceOf = (inv) => Math.round((Number(inv.total) - Number(inv.amount_paid)) * 100) / 100;
export const isOpen = (inv) => inv.status === "unpaid" || inv.status === "partial";

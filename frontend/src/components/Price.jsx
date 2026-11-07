import RiyalMark from "./RiyalMark";
import { currencyName, formatAmount } from "../utils/plans";

/** Amount + official Saudi Riyal mark (or named currency for others). */
export default function Price({ amount, currency, className = "" }) {
  const value = formatAmount(amount);
  if (String(currency).toUpperCase() === "SAR") {
    return (
      <span className={`price-with-riyal ${className}`.trim()} dir="ltr">
        <span className="price-with-riyal__amount">{value}</span>
        <RiyalMark className="price-with-riyal__mark" />
      </span>
    );
  }
  return (
    <span className={className}>
      {value} {currencyName(currency)}
    </span>
  );
}

/** Currency label: SAR shows the official mark instead of «ريال سعودي». */
export function CurrencyLabel({ code, showCode = true, className = "" }) {
  if (String(code).toUpperCase() === "SAR") {
    return (
      <span className={`currency-label ${className}`.trim()}>
        <RiyalMark className="currency-label__mark" />
        {showCode ? <span dir="ltr"> (SAR)</span> : null}
      </span>
    );
  }
  return (
    <span className={className}>
      {showCode ? `${currencyName(code)} (${code})` : currencyName(code)}
    </span>
  );
}

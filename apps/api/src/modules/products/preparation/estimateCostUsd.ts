/**
 * The cost of a card in dollars, counted without floats and only shown as a decimal string.
 * Every arithmetic step is on integers in micro-dollars (µ$ = $1e-6); the four-digit decimal is
 * produced at the very end with half-up rounding on the fifth digit.
 */

export type ModelPricing = {
  readonly inputMicroDollarsPerToken: number;
  readonly outputMicroDollarsPerToken: number;
};

export type ModelUsage = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/**
 * `null` is "unknown", not "nothing": a card whose preparation history names a model this table
 * does not know would be undercounted, and that is worse than hiding the sum. "0.0000" belongs
 * to a card that has not been prepared at all — zero spent, which is a different fact.
 */
export function estimateCostUsd(
  usage: readonly ModelUsage[],
  pricing: Readonly<Record<string, ModelPricing>>,
): string | null {
  let microDollars = 0;
  for (const { model, inputTokens, outputTokens } of usage) {
    const rate = pricing[model];
    if (rate === undefined) {
      return null;
    }
    microDollars +=
      inputTokens * rate.inputMicroDollarsPerToken + outputTokens * rate.outputMicroDollarsPerToken;
  }
  return formatMicroDollars(microDollars);
}

/**
 * µ$ to a decimal string with exactly four fractional digits, rounded half-up. Integer division
 * keeps the whole computation off the float path, which is the point of `CLAUDE.md`'s money rule.
 */
function formatMicroDollars(microDollars: number): string {
  // 1 unit of the fourth decimal is 100 µ$; dividing by 100 moves the sum into tenths of a cent.
  const quotient = Math.floor(microDollars / 100);
  const remainder = microDollars % 100;
  const tenthsOfACent = remainder >= 50 ? quotient + 1 : quotient;
  const whole = Math.floor(tenthsOfACent / 10_000);
  const fraction = tenthsOfACent % 10_000;
  return `${String(whole)}.${String(fraction).padStart(4, '0')}`;
}

import {
  applyDomainReplacements,
  applyDomainScores,
  filterBlockedDomains,
} from "../../utils/domain-filter";
import type { ScoredResult } from "../../types";

export async function applyDomainRules(
  results: ScoredResult[],
): Promise<ScoredResult[]> {
  const afterBlock = await filterBlockedDomains(results);
  const afterReplace = await applyDomainReplacements(afterBlock);
  return applyDomainScores(afterReplace);
}

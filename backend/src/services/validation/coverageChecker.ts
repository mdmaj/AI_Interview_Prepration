export interface CoverageRequirement {
  id: string;
  priority: "must" | "nice";
}

export interface CoverageQuestion {
  id: string;
  requirement_ids: string[];
}

export interface CoverageResult {
  uncovered_requirement_ids: string[];
  covered_requirement_ids: string[];
  must_have_uncovered: string[];
  is_complete: boolean;
}

export const checkCoverage = (
  requirements: CoverageRequirement[],
  questions: CoverageQuestion[],
): CoverageResult => {
  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id),
  );

  const coveredRequirementIds = new Set<string>();

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      if (validRequirementIds.has(requirementId)) {
        coveredRequirementIds.add(requirementId);
      }
    }
  }

  const coveredRequirementIdsList = requirements
    .filter((requirement) =>
      coveredRequirementIds.has(requirement.id),
    )
    .map((requirement) => requirement.id);

  const uncoveredRequirementIds = requirements
    .filter(
      (requirement) =>
        !coveredRequirementIds.has(requirement.id),
    )
    .map((requirement) => requirement.id);

  const mustHaveUncovered = requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        !coveredRequirementIds.has(requirement.id),
    )
    .map((requirement) => requirement.id);

  return {
    uncovered_requirement_ids: uncoveredRequirementIds,
    covered_requirement_ids: coveredRequirementIdsList,
    must_have_uncovered: mustHaveUncovered,
    is_complete: mustHaveUncovered.length === 0,
  };
};
type Resource = {
  videoId?: string;
  startTime?: number;
  endTime?: number;
};

type FinalConcept = {
  id?: string;
  resources?: Resource[];
};

type OrderedConcept = {
  id: string;
};

type CandidateChunk = {
  videoId: string;
  startTime: number;
  endTime: number;
};

type CandidateConcept = {
  id: string;
  chunks: CandidateChunk[];
};

export type ValidationReport = {
  passed: boolean;

  conceptOrderValid: boolean;

  totalConcepts: number;
  conceptsWithResources: number;
  conceptCoverage: number;

  totalResources: number;
  groundedResources: number;
  resourceGrounding: number;

  duplicateResources: number;

  issues: string[];
};

export function validateLearningPath({
  learningPath,
  orderedConcepts,
  candidateConcepts,
}: {
  learningPath: FinalConcept[];
  orderedConcepts: OrderedConcept[];
  candidateConcepts: CandidateConcept[];
}): ValidationReport {
  const issues: string[] = [];

  /*
   * ============================================================
   * CONCEPT ORDER
   * ============================================================
   */

  const expectedOrder =
    orderedConcepts.map(
      (concept) =>
        concept.id
    );

  const actualOrder =
    learningPath.map(
      (concept) =>
        concept.id
    );

  const conceptOrderValid =
    expectedOrder.length ===
      actualOrder.length &&
    expectedOrder.every(
      (id, index) =>
        id ===
        actualOrder[index]
    );

  if (!conceptOrderValid) {
    issues.push(
      "Final concept order does not match the prerequisite order."
    );
  }

  /*
   * ============================================================
   * RESOURCE VALIDATION
   * ============================================================
   */

  let conceptsWithResources = 0;
  let totalResources = 0;
  let groundedResources = 0;

  const resourceKeys =
    new Set<string>();

  let duplicateResources = 0;

  const candidateMap =
    new Map(
      candidateConcepts.map(
        (concept) => [
          concept.id,
          concept.chunks,
        ]
      )
    );

  for (
    const concept of learningPath
  ) {
    const resources =
      Array.isArray(
        concept.resources
      )
        ? concept.resources
        : [];

    if (
      resources.length > 0
    ) {
      conceptsWithResources++;
    }

    const candidates =
      concept.id
        ? candidateMap.get(
            concept.id
          ) || []
        : [];

    for (
      const resource of resources
    ) {
      totalResources++;

      const start =
        Number(
          resource.startTime
        );

      const end =
        Number(
          resource.endTime
        );

      if (
        !resource.videoId ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end <= start
      ) {
        issues.push(
          `Invalid resource for ${concept.id || "unknown concept"}.`
        );

        continue;
      }

      /*
       * Confirm the final resource
       * came from an optimized finalist.
       */

      const grounded =
        candidates.some(
          (candidate) =>
            candidate.videoId ===
              resource.videoId &&
            Math.abs(
              candidate.startTime -
                start
            ) <= 1 &&
            Math.abs(
              candidate.endTime -
                end
            ) <= 1
        );

      if (grounded) {
        groundedResources++;
      } else {
        issues.push(
          `Ungrounded resource detected for ${concept.id}.`
        );
      }

      /*
       * Detect the same exact video
       * segment appearing multiple times.
       */

      const resourceKey =
        `${resource.videoId}:${start}:${end}`;

      if (
        resourceKeys.has(
          resourceKey
        )
      ) {
        duplicateResources++;
      } else {
        resourceKeys.add(
          resourceKey
        );
      }
    }
  }

  if (
    duplicateResources > 0
  ) {
    issues.push(
      `${duplicateResources} duplicate final resources detected.`
    );
  }

  const totalConcepts =
    learningPath.length;

  const conceptCoverage =
    totalConcepts > 0
      ? Number(
          (
            (conceptsWithResources /
              totalConcepts) *
            100
          ).toFixed(1)
        )
      : 0;

  const resourceGrounding =
    totalResources > 0
      ? Number(
          (
            (groundedResources /
              totalResources) *
            100
          ).toFixed(1)
        )
      : 100;

  /*
   * A concept having no resource is
   * allowed. It is not automatically
   * considered a validation failure.
   */

  const passed =
    conceptOrderValid &&
    resourceGrounding === 100 &&
    duplicateResources === 0;

  return {
    passed,

    conceptOrderValid,

    totalConcepts,
    conceptsWithResources,
    conceptCoverage,

    totalResources,
    groundedResources,
    resourceGrounding,

    duplicateResources,

    issues,
  };
}
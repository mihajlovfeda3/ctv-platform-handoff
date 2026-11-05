import { stableId } from "../src/lib/identity";
import { scenarioProfile, scenarioProfiles } from "./scenario-profiles";
import {
  demoId,
  directionAliases,
  functionalGroupId,
  originalDirections,
  referenceMethodId,
  referenceTechnologyId,
  technologyReference,
} from "../src/domain/ctv-reference";
import { functionalGroupNames } from "../src/domain/terminology";
export const SYNTHETIC_SEED = 20261027;
export function generateLegacyDataset(size = 80, seed = SYNTHETIC_SEED) {
  if (!Number.isInteger(size) || size < 1 || size > 10000)
    throw new Error("Размер набора: 1–10 000");
  let state = seed >>> 0;
  const random = (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 4294967296) * max);
  };
  const id = (key: string) => stableId(`synthetic-v1:${seed}:${key}`);
  const sourceId = id("source");
  const meta = (key: string, name: string) => ({
    id: id(key),
    name,
    sourceId,
    isSynthetic: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
  const sources = [
    {
      id: sourceId,
      name: `Синтетический генератор v1 · seed ${seed}`,
      kind: "synthetic",
      isSynthetic: true,
    },
  ];
  const organizations = [
    meta("organization", "Учебная организация «Контур» (синтетическая)"),
  ];
  const groups = [
    "Производство",
    "Логистика",
    "Корпоративные функции",
    "Развитие и обучение",
  ].map((n, i) => meta(`group:${i}`, n));
  const business = [
    "Эксплуатация оборудования",
    "Управление поставками",
    "Работа с документами",
    "Подготовка персонала",
  ].flatMap((name, i) => [
    {
      ...meta(`business:${i}`, name),
      kind: "direction" as const,
      parentId: null,
    },
    {
      ...meta(
        `process:${i}`,
        [
          "Техническое обслуживание",
          "Складские операции",
          "Согласование документов",
          "Обучение сотрудников",
        ][i],
      ),
      kind: "process" as const,
      parentId: id(`business:${i}`),
    },
    {
      ...meta(`stage:${i}`, `Учебный этап ${i + 1}`),
      kind: "stage" as const,
      parentId: id(`process:${i}`),
    },
  ]);
  const tasks = [
    "Сократить время диагностики оборудования",
    "Снизить ошибки при учёте запасов",
    "Ускорить проверку документов",
    "Повысить качество подготовки персонала",
  ].map((name, i) => ({
    ...meta(`task:${i}`, name),
    businessNodeId: id(`process:${i}`),
  }));
  const techNames = [
    "Искусственный интеллект",
    "Промышленный интернет",
    "Робототехника",
    "Иммерсивные технологии",
    "Автоматизация процессов",
    "Средства коллаборации",
  ];
  const directions = techNames.map((name, i) => meta(`direction:${i}`, name));
  const technologyNames = [
    ["Аналитические модели", "Компьютерное зрение"],
    ["Сенсорные сети", "Граничные вычисления"],
    ["Мобильные роботы", "Манипуляторы"],
    ["Виртуальная реальность", "Дополненная реальность"],
    ["Программные роботы", "Анализ процессов"],
    ["Базы знаний", "Совместная работа"],
  ];
  const technologies = technologyNames.flatMap((names, i) =>
    names.map((name, j) => ({
      ...meta(`technology:${i}:${j}`, name),
      directionId: id(`direction:${i}`),
    })),
  );
  const methods = technologies.flatMap((tech, i) =>
    [0, 1].map((j) => ({
      ...meta(
        `method:${i}:${j}`,
        `${["Мониторинг", "Поддержка решений"][j]} · ${tech.name.toLowerCase()}`,
      ),
      technologyId: tech.id,
    })),
  );
  const vendors = Array.from({ length: 4 }, (_, i) =>
    meta(`vendor:${i}`, `Учебный поставщик ${i + 1}`),
  );
  const solutions = Array.from({ length: 8 }, (_, i) => ({
    ...meta(`solution:${i}`, `Тестовое решение ${i + 1}`),
    vendorId: vendors[i % 4].id,
    specification: "Вымышленный продукт для проверки связей платформы.",
  }));
  const cases = Array.from({ length: 8 }, (_, i) => ({
    ...meta(`case:${i}`, `Учебный пример внедрения ${i + 1}`),
    organizationId: organizations[0].id,
    solutionId: solutions[i].id,
    implementationYear: 2025,
  }));
  const projects = Array.from({ length: 6 }, (_, i) => ({
    ...meta(`project:${i}`, `Синтетический проект ${i + 1}`),
    organizationId: organizations[0].id,
    kind: "project",
    status: "Учебный пилот",
  }));
  const effects = [
    "Снижение трудозатрат",
    "Повышение безопасности",
    "Сокращение длительности операций",
    "Повышение качества",
  ].map((name, i) => meta(`effect:${i}`, name));
  const actions = [
    "Прогнозирование отклонений",
    "Автоматический контроль качества",
    "Поддержка планирования",
    "Мониторинг состояния",
    "Анализ причин ошибок",
  ];
  const scenarios = Array.from({ length: size }, (_, i) => {
    const group = random(4),
      method = methods[random(methods.length)];
    return {
      ...meta(
        `scenario:${i}`,
        `${actions[i % 5]} в процессе «${business[group * 3 + 1].name.toLowerCase()}»`,
      ),
      externalId: `SYN-${String(i + 1).padStart(4, "0")}`,
      originNamespace: `synthetic-v1-${seed}`,
      description: `Учебный сценарий: ${method.name.toLowerCase()} для процесса «${business[group * 3 + 1].name}». Сценарий предназначен для проверки каталога и связей. Все сведения и оценки вымышлены.`,
      rationale: "Синтетическая гипотеза для разработки платформы.",
      functionalGroupId: groups[group].id,
      businessNodeId: id(`process:${group}`),
      businessChallenge: tasks[group].name,
      implementation: (["yes", "no", "unknown"] as const)[i % 3],
      ooda: (["observe", "orient", "decide", "act"] as const)[group],
      technologyTrend: null,
      projectProposal: i % 3 ? null : "Проверить гипотезу на учебном стенде.",
      _methodId: method.id,
      _taskId: tasks[group].id,
    };
  });
  const assessments = scenarios.flatMap((scenario, i) =>
    (
      [
        "market_maturity",
        "organizational_readiness",
        "business_impact",
        "application_trl",
      ] as const
    ).flatMap((metric, j) =>
      (i + j) % 9 === 0
        ? []
        : [
            {
              id: id(`assessment:${i}:${metric}`),
              scenarioId: scenario.id,
              metric,
              value:
                1 +
                (parseInt(id(`value:${i}:${metric}`).slice(0, 8), 16) %
                  [5, 7, 3, 9][j]),
              sourceId,
              assessedAt: new Date("2026-01-01T00:00:00Z"),
              organizationalContext: "synthetic-lab",
              isSynthetic: true,
            },
          ],
    ),
  );
  const link = (scenarioId: string) => ({
    scenarioId,
    sourceId,
    isSynthetic: true,
  });
  return {
    sources,
    organizations,
    groups,
    business,
    tasks,
    directions,
    technologies,
    methods,
    vendors,
    solutions,
    cases,
    projects,
    effects,
    scenarios: scenarios.map(({ _methodId, _taskId, ...row }) => {
      void _methodId;
      void _taskId;
      return row;
    }),
    assessments,
    scenarioTechnologies: scenarios.flatMap((row, i) => [
      { ...link(row.id), methodId: row._methodId },
      ...(i % 4 === 0
        ? [
            {
              ...link(row.id),
              methodId:
                methods[
                  (methods.findIndex((m) => m.id === row._methodId) + 1) %
                    methods.length
                ].id,
            },
          ]
        : []),
    ]),
    scenarioTasks: scenarios.map((row) => ({
      ...link(row.id),
      taskId: row._taskId,
    })),
    scenarioEffects: scenarios.map((row, i) => ({
      ...link(row.id),
      effectId: effects[i % effects.length].id,
    })),
    scenarioCases: scenarios
      .filter((_, i) => i % 3 === 0)
      .map((row, i) => ({
        ...link(row.id),
        caseId: cases[i % cases.length].id,
      })),
    scenarioSolutions: scenarios
      .filter((_, i) => i % 2 === 0)
      .map((row, i) => ({
        ...link(row.id),
        solutionId: solutions[i % solutions.length].id,
      })),
    scenarioProjects: scenarios
      .filter((_, i) => i % 4 === 0)
      .map((row, i) => ({
        ...link(row.id),
        projectId: projects[i % projects.length].id,
      })),
  };
}

export function generateDataset(size = 80, seed = SYNTHETIC_SEED) {
  const legacy = generateLegacyDataset(size, seed);
  const sourceId = legacy.sources[0].id;
  const meta = (
    id: string,
    name: string,
    description: string | null = null,
  ) => ({
    id,
    name,
    description,
    sourceId,
    isSynthetic: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
  const link = (scenarioId: string) => ({
    scenarioId,
    sourceId,
    isSynthetic: true,
  });
  const technologies = [
    ...new Map(
      technologyReference.map(([direction, technology]) => {
        const id = referenceTechnologyId(direction, technology);
        return [
          id,
          {
            ...meta(id, technology),
            directionId: demoId(
              `direction:${originalDirections.indexOf(directionAliases[direction] ?? direction)}`,
            ),
          },
        ];
      }),
    ).values(),
  ];
  return {
    ...legacy,
    groups: [
      ...legacy.groups,
      ...functionalGroupNames.map((name) =>
        meta(functionalGroupId(name), name, "ctv-functional-groups-v1"),
      ),
    ],
    business: [
      ...legacy.business,
      ...scenarioProfiles.map((profile, i) => ({
        ...meta(demoId(`scenario-process:${i}`), profile.process),
        kind: "process" as const,
        parentId: null,
      })),
    ],
    tasks: [
      ...legacy.tasks,
      ...scenarioProfiles.map((profile, i) => ({
        ...meta(demoId(`scenario-task:${i}`), profile.task),
        businessNodeId: demoId(`scenario-process:${i}`),
      })),
    ],
    directions: [
      ...legacy.directions,
      ...originalDirections.map((name, i) =>
        meta(demoId(`direction:${i}`), name, "ctv-demo-classification-v2"),
      ),
    ],
    technologies: [...legacy.technologies, ...technologies],
    methods: [
      ...legacy.methods,
      ...technologyReference.map(([direction, technology, method]) => ({
        ...meta(referenceMethodId(direction, technology, method), method),
        technologyId: referenceTechnologyId(direction, technology),
      })),
    ],
    scenarios: legacy.scenarios.map((row, index) => {
      const profile = scenarioProfile(index);
      return {
        ...row,
        name: profile.name,
        description: profile.description,
        functionalGroupId: profile.groupId,
        businessNodeId: profile.processId,
        businessChallenge: profile.challenge,
        businessChallengeDescription: profile.problem,
        businessEffect: profile.effect,
        rationale: null,
        projectProposal: null,
      };
    }),
    scenarioTechnologies: legacy.scenarios.map((row, index) => ({
      ...link(row.id),
      methodId: scenarioProfile(index).methodId,
    })),
    scenarioTasks: legacy.scenarios.map((row, index) => ({
      ...link(row.id),
      taskId: scenarioProfile(index).taskId,
    })),
    scenarioEffects: legacy.scenarios.map((row, index) => ({
      ...link(row.id),
      effectId: legacy.effects[scenarioProfile(index).effectIndex].id,
    })),
  };
}

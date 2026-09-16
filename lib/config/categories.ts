import type { CategoryId } from "@/lib/types";

/**
 * Category taxonomy (docs/architecture.md §6).
 * Owner: P2 (queries, keywords, definitions) · P4 may edit the RU labels/descriptions via PR.
 * UI labels use the case's own wording so judges can tick their checklist.
 */
export interface CategoryConfig {
  id: CategoryId;
  labelRu: string;
  labelEn: string;
  /** One of the 5 mandatory photo areas: campus, dormitories, classrooms, libraries, city. */
  requiredArea: boolean;
  /** Label of the mandatory filter (dormitory, sports, labs, student life), if this category is one. */
  filterLabelRu?: string;
  /** Short explanation for users (RU). */
  descriptionRu: string;
  /** Definition passed to the vision model (EN). */
  definition: string;
  /** Web search query templates. Placeholders: {name} (university), {city}. */
  queries: { en: string[]; ru: string[]; kk?: string[] };
  /** Matches Commons subcategory names / file titles that hint at this category. */
  commonsKeywords: RegExp;
}

export const CATEGORIES: readonly CategoryConfig[] = [
  {
    id: "campus",
    labelRu: "Кампус",
    labelEn: "Campus",
    requiredArea: true,
    descriptionRu: "Корпуса, территория, входы, виды сверху",
    definition: "Exterior of university buildings, grounds, entrances, courtyards and aerial views of the campus.",
    queries: {
      en: ['"{name}" campus', '"{name}" main building'],
      ru: ['"{name}" кампус', '"{name}" главный корпус'],
      kk: ['"{name}" кампус'],
    },
    commonsKeywords: /campus|main building|building|entrance|aerial|кампус|корпус|здание/i,
  },
  {
    id: "dormitory",
    labelRu: "Общежития",
    labelEn: "Dormitories",
    requiredArea: true,
    filterLabelRu: "Общежитие",
    descriptionRu: "Здания общежитий, комнаты, общие зоны",
    definition: "Student housing: dormitory buildings, residence halls, dorm rooms and their common areas.",
    queries: {
      en: ['"{name}" dormitory', '"{name}" student housing'],
      ru: ['"{name}" общежитие', '"{name}" студенческий городок'],
      kk: ['"{name}" жатақхана'],
    },
    commonsKeywords:
      /dormitor|residence hall|hall of residence|hostel|student housing|общежит|студгородок|студенческий городок|жатақхана/i,
  },
  {
    id: "classroom",
    labelRu: "Аудитории",
    labelEn: "Classrooms",
    requiredArea: true,
    descriptionRu: "Лекционные залы, учебные аудитории, семинарские комнаты",
    definition: "Lecture halls, classrooms, seminar rooms and auditoriums used for teaching.",
    queries: {
      en: ['"{name}" lecture hall', '"{name}" classroom'],
      ru: ['"{name}" аудитория', '"{name}" лекционный зал'],
    },
    commonsKeywords: /auditor|lecture|classroom|seminar room|аудитор|лекцион/i,
  },
  {
    id: "library",
    labelRu: "Библиотеки",
    labelEn: "Libraries",
    requiredArea: true,
    descriptionRu: "Здания библиотек, читальные залы, книгохранилища",
    definition: "Library buildings, reading rooms, book stacks and study spaces inside a library.",
    queries: {
      en: ['"{name}" library'],
      ru: ['"{name}" библиотека'],
      kk: ['"{name}" кітапхана'],
    },
    commonsKeywords: /librar|reading room|библиотек|читальн|кітапхана/i,
  },
  {
    id: "city",
    labelRu: "Город",
    labelEn: "City",
    requiredArea: true,
    descriptionRu: "Город, в котором находится университет",
    definition:
      "The city where the university is located: skyline, streets, landmarks and public spaces (not the campus itself).",
    queries: {
      en: ["{city} city skyline", "{city} landmarks"],
      ru: ["{city} город"],
    },
    commonsKeywords: /skyline|panorama|cityscape|street|square|landmark|панорам|город|улиц|площад/i,
  },
  {
    id: "sports",
    labelRu: "Спорт",
    labelEn: "Sports",
    requiredArea: false,
    filterLabelRu: "Спорт",
    descriptionRu: "Спортзалы, стадионы, бассейны, площадки",
    definition: "Sports facilities: gyms, stadiums, swimming pools, sports halls, fields and courts.",
    queries: {
      en: ['"{name}" sports complex', '"{name}" gym'],
      ru: ['"{name}" спорткомплекс', '"{name}" спортзал'],
    },
    commonsKeywords: /sport|stadium|gym|swimming pool|arena|спорт|стадион|бассейн/i,
  },
  {
    id: "lab",
    labelRu: "Лаборатории",
    labelEn: "Labs",
    requiredArea: false,
    filterLabelRu: "Лаборатории",
    descriptionRu: "Лаборатории, мейкерспейсы, компьютерные классы",
    definition: "Laboratories, makerspaces, computer labs, research equipment and workshops.",
    queries: {
      en: ['"{name}" laboratory'],
      ru: ['"{name}" лаборатория'],
    },
    commonsKeywords: /laborator|makerspace|research center|лаборатор/i,
  },
  {
    id: "student_life",
    labelRu: "Студенческая жизнь",
    labelEn: "Student life",
    requiredArea: false,
    filterLabelRu: "Студенческая жизнь",
    descriptionRu: "Мероприятия, клубы, столовые, студенты на кампусе",
    definition:
      "Student activities on campus: events, clubs, ceremonies, cafeterias, students studying together (no close-up portraits).",
    queries: {
      en: ['"{name}" students', '"{name}" student life'],
      ru: ['"{name}" студенты', '"{name}" студенческая жизнь'],
    },
    commonsKeywords: /student|graduation|ceremony|event|club|cafeteria|студент|выпуск|праздник|столов/i,
  },
] as const;

export const CATEGORY_BY_ID: Record<CategoryId, CategoryConfig> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryConfig>;

/** The 5 mandatory photo areas, in display order. */
export const REQUIRED_AREAS = CATEGORIES.filter((c) => c.requiredArea);

/** The 4 mandatory filters, in display order. */
export const MANDATORY_FILTERS = CATEGORIES.filter((c) => c.filterLabelRu);

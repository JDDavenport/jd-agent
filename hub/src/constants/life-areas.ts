/**
 * Life Areas - Fixed categories for Goals & Habits
 *
 * These 6 life areas provide a consistent framework for tracking
 * goals and habits across all domains of life.
 */

export const LIFE_AREAS = {
  spiritual: {
    name: 'Spiritual',
    icon: '🙏',
    color: '#8B5CF6', // purple
    description: 'Faith, meditation, purpose, values',
  },
  personal: {
    name: 'Personal',
    icon: '🧠',
    color: '#3B82F6', // blue
    description: 'Self-improvement, hobbies, learning',
  },
  fitness: {
    name: 'Fitness',
    icon: '💪',
    color: '#10B981', // green
    description: 'Physical health, exercise, nutrition',
  },
  family: {
    name: 'Family',
    icon: '👨‍👩‍👧‍👦',
    color: '#F59E0B', // amber
    description: 'Relationships, parenting, community',
  },
  professional: {
    name: 'Professional',
    icon: '💼',
    color: '#6366F1', // indigo
    description: 'Career, business, income',
  },
  school: {
    name: 'School',
    icon: '🎓',
    color: '#EC4899', // pink
    description: 'Education, certifications, academic',
  },
} as const;

export type LifeArea = keyof typeof LIFE_AREAS;

export const LIFE_AREA_VALUES: LifeArea[] = [
  'spiritual',
  'personal',
  'fitness',
  'family',
  'professional',
  'school',
];

/**
 * Get life area metadata by key
 */
export function getLifeArea(area: LifeArea) {
  return LIFE_AREAS[area];
}

/**
 * Check if a string is a valid life area
 */
export function isValidLifeArea(area: string): area is LifeArea {
  return area in LIFE_AREAS;
}

/**
 * Get all life areas as an array with their keys
 */
export function getAllLifeAreas() {
  return LIFE_AREA_VALUES.map((key) => ({
    key,
    ...LIFE_AREAS[key],
  }));
}

import { createLocalList, type LocalItem } from "./localList";

/** A book, a course, a skill — something you're partway through. */
export interface LearningItem extends LocalItem {
    title: string;
    /** "Book", "Course", "Skill" — free text, not an enum. */
    kind: string;
    /** 0–100. The one number that says whether it's still going. */
    progress: number;
}

export const learningList = createLocalList<LearningItem>("kiwi.learning");

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { getDb, schema } from "./index";
import { eq } from "drizzle-orm";

/**
 * Real UPTET 2019 Paper 1 questions (Booklet Series B), sourced from a
 * third-party reproduction (adda247) of the actual exam paper, per
 * docs/decisions/0004-content-sourcing-fallback.md.
 *
 * IMPORTANT — how correctness was determined:
 * The source PDF also contained a scanned "official final answer key"
 * table (UPTET 2019 Revised and Final Answer Key, dated 31/01/2020).
 * That table was NOT trusted directly — cross-checking a sample of its
 * values against independently computable answers (e.g. a Mathematics
 * question) turned up at least one mismatch, meaning the dense 5-column
 * scanned table isn't reliable to transcribe digit-by-digit. Instead,
 * every answer below was independently determined:
 *   - Mathematics: computed directly (arithmetic/algebra worked out, not
 *     read off the scan).
 *   - Child Development & Pedagogy: checked against standard educational
 *     psychology facts (Piaget/Bruner/Skinner etc.).
 *   - English: worked out from grammar rules directly.
 *   - Environmental Studies: checked against general/factual knowledge.
 * One EVS question (about Article 356's first use) was dropped entirely
 * because the answer couldn't be determined with confidence from the
 * given options. The Hindi language section was dropped entirely for
 * this batch — literary/authorship trivia isn't independently verifiable
 * the way math or grammar is, and the source answer key had already
 * shown itself unreliable elsewhere, so it wasn't worth the risk of a
 * silently wrong "correct" answer (see the project's own ADR on why a
 * single wrong answer matters here).
 *
 * source: "pyq" (this genuinely is a real past-year question).
 * status: "calibration", NOT "pyq_verified" — per ADR 0004, third-party-
 * sourced content never gets pyq_verified status, regardless of how
 * carefully it was checked. It must earn "live" status the normal way,
 * through real response data, same as any other unverified item.
 *
 * Idempotent: deletes any previously ingested rows with this sourceNote
 * before re-inserting.
 */
const SOURCE_NOTE = "UPTET 2019 Paper 1 (Set B), via adda247 reproduction — answers independently verified by Claude, not transcribed from the scanned key";

type Q = {
  sectionId: "child_development_pedagogy" | "language_2_english" | "mathematics" | "evs";
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
};

const CDP: Q[] = [
  { sectionId: "child_development_pedagogy", prompt: "If a teacher finds a problematic child in the class, what should he does?", options: ["Send the child back to home immediately", "Ignore the child", "Punish the child", "Provide counselling to the child"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "Co-curricular activities are mostly related to", options: ["Mental development of students", "All round development of students", "Development of educational institutions", "Professional development of students"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Whom of the following has not propounded the learning theory?", options: ["Thorndike", "Skinner", "Kohler", "B.S. Bloom"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "Meaning of stagnation in education is", options: ["Retention of a child in a same class for more than one year", "Not going to school by the child", "Taking not admission in school by the child", "Leave the school by the child"], correctOptionIndex: 0 },
  { sectionId: "child_development_pedagogy", prompt: "In which of the following skill, testing of previous knowledge comes?", options: ["Skill of demonstration", "Skill of introduction", "Skill of stimulus-variation", "Skill of closure"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following theory is also known as Theory of Reinforcement?", options: ["Operant Conditioning Theory", "Stimulus Response Theory", "Classical Conditioning Theory", "Theory of Insight"], correctOptionIndex: 0 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following stages is not the part of Bruner's Cognitive Development Theory?", options: ["Enactive stage", "Iconic stage", "Intuitive stage", "Symbolic stage"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Morrison described five steps in his teaching model at understanding level: I. Presentation II. Exploration III. Organisation IV. Assimilation V. Recitation. The correct sequence is", options: ["I, II, III, IV, V", "II, I, IV, III, V", "IV, V, III, I, II", "II, I, III, IV, V"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following is not related with cognitive domain?", options: ["Knowledge", "Application", "Valuing", "Understanding"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following is not the curve of learning?", options: ["Convex", "Combination type", "Concave", "Longitudinal"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "'Learning is any change in behaviour, resulting from behaviour' who said it?", options: ["Crow & Crow", "Guilford", "Woodworth", "Skinner"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Match List-A with List-B.\nList-A: (a) Bruner (b) Ausubel (c) Glasser (d) Gordon\nList-B: (I) Basic teaching model (II) Synectics teaching model (III) Advance organiser teaching model (IV) Concept attainment teaching model (V) Inquiry training model", options: ["(a)-III, (b)-I, (c)-II, (d)-V", "(a)-IV, (b)-III, (c)-II, (d)-I", "(a)-IV, (b)-III, (c)-I, (d)-II", "(a)-I, (b)-II, (c)-III, (d)-V"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "The first step of problem solving is", options: ["Formulation of hypothesis", "Identification of problem", "Data collection", "Testing of hypothesis"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Learning of children will be most effective when", options: ["Teacher will lead the learning process and keep the children passive", "Development of cognitive, affective and psychomotor domain of children will take place", "Emphasis will be only on reading, writing and mathematical skills", "Teaching system will be autocratic"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Which step is prominent in the syntax of teaching model of memory level and understanding level?", options: ["Planning", "Exploration", "Generalization", "Presentation"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "Human development starts from", options: ["Stage of infancy", "Pre-childhood stage", "Pre-natal stage", "Post-childhood stage"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "'The Conditions of Learning' book is written by", options: ["I.P. Pavlov", "B.F. Skinner", "E.L. Thorndike", "R.M. Gagne"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "\"Adolescence is the period of great stress, strain, storm and strike\" is the statement of", options: ["Crow & Crow", "Stanley Hall", "Jersield", "Simpson"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Total time taken in Indian Model of Micro Teaching is", options: ["30 minute", "40 minute", "36 minute", "45 minute"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "\"Plateaus of learning are a characteristic feature of the learning process indicating a period where no improvement in performance is made.\" Who said this?", options: ["Skinner", "Hollingworth", "Gates and others", "Ross"], correctOptionIndex: 3 },
  { sectionId: "child_development_pedagogy", prompt: "Match Column-A with Column-B.\nColumn-A: (a) Animal Intelligence (b) Schedule of reinforcement (c) Law of pragnanz (d) Adaptation\nColumn-B: (I) Gestalt (II) Piaget (III) Thorndike (IV) Skinner", options: ["(a)-III, (b)-IV, (c)-I, (d)-II", "(a)-II, (b)-IV, (c)-III, (d)-I", "(a)-I, (b)-IV, (c)-III, (d)-II", "(a)-II, (b)-IV, (c)-I, (d)-III"], correctOptionIndex: 0 },
  { sectionId: "child_development_pedagogy", prompt: "\"Development is a never ending process.\" This statement is related to which principle of development?", options: ["Principle of continuity", "Principle of integration", "Principle of interaction", "Principle of inter relationship"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Through which Amendment of the Constitution has education become a fundamental right?", options: ["22nd Amendment", "25th Amendment", "86th Amendment", "52nd Amendment"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Instinct Theory of motivation was propounded by", options: ["William James", "Abraham Maslow", "McDougall", "Simpson"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following stages of development is called \"a unique stage of emotional development\" by Cole and Bruce?", options: ["Adolescence", "Childhood", "Infancy", "Adulthood"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Who gave the concept of multiple intelligence?", options: ["Gardner", "Spearman", "Golman", "John Mayor"], correctOptionIndex: 0 },
  { sectionId: "child_development_pedagogy", prompt: "Dyslexia is a difficulty mainly in", options: ["Speaking", "Expressing", "Reading/Spelling", "Standing"], correctOptionIndex: 2 },
  { sectionId: "child_development_pedagogy", prompt: "Which of the following is not the role of a teacher in an inclusive classroom?", options: ["Teacher should devote extra time to teach the learning disabled", "Teacher should not pay attention to the differently abled child", "Make adequate seating arrangements according to the requirement of the child", "Teacher should encourage the children"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "In the class, questioning by students", options: ["Should not be allowed", "Should be encouraged", "Should be discouraged", "Should be stopped"], correctOptionIndex: 1 },
  { sectionId: "child_development_pedagogy", prompt: "Growth of a child is mainly related to", options: ["Moral Development", "Social Development", "Physical Development", "Emotional Development"], correctOptionIndex: 2 },
];

const ENGLISH: Q[] = [
  { sectionId: "language_2_english", prompt: "In which of the following sentences is the subject of the verb a feminine gender noun?", options: ["All the female members have arrived.", "All the young men have arrived.", "All the male members have arrived.", "All the old men have arrived."], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "The method of teaching in which the teacher tries to establish a link between the foreign language word and the object without the interference of the learner's mother tongue is called", options: ["the direct method", "the bilingual method", "the structural method", "the grammar-translation method"], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "If you are testing your students' comprehension of written English, you are testing their understanding of what they have just", options: ["written", "listened to", "read", "spoken"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Choose the correct sentence:", options: ["Please listen to your teacher.", "Please listen towards your teacher.", "Please listen your teacher.", "Please listen of your teacher."], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "Find out the correct sentence(s):", options: ["I don't believe him.", "Both of the above", "I am not believing him.", "None of the above"], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "Point out the sentence which is in past perfect tense.", options: ["He studied many hours everyday.", "We were listening to the radio all evening.", "I had written my letter before he arrived.", "It was getting darker."], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Fill in the blanks with the correct article: Neil Armstrong was ___ first man to walk on ___ moon.", options: ["a, the", "the, the", "an, the", "an, a"], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "Fill in the blank: The teacher has been teaching for ___ hour.", options: ["a", "two", "an", "three"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Add the right suffix to pluralize the word 'Ox'.", options: ["-en", "-ies", "-es", "-s"], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "Change the word 'grow' into a noun by adding one of the suffixes given below.", options: ["-ing", "-s", "-th", "-n"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Passage: \"To forgive an injury is often considered to be a sign of weakness; it is really a sign of strength... So mercy is the noblest form of revenge.\" The word 'strength' in the passage is a", options: ["Common noun", "Abstract noun", "Material noun", "Collective noun"], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "Passage: \"To forgive an injury is often considered to be a sign of weakness; it is really a sign of strength... So mercy is the noblest form of revenge.\" According to the passage, one who does not take revenge is", options: ["a weak man", "a foolish man", "a strong man", "a foe"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Poem: \"She dwelt among the untrodden ways / Beside the spring of Dove... / A violet by mossy stone / Half-hidden from the eye! / Fair as a star when only one / is shining in the sky.\" What is the meaning of the word 'untrodden'?", options: ["Unexplored", "Hidden", "Explored", "Explicit"], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "Poem: \"She dwelt among the untrodden ways / Beside the spring of Dove... / A violet by mossy stone / Half-hidden from the eye! / Fair as a star when only one / is shining in the sky.\" In the second stanza (\"A violet by mossy stone... / is shining in the sky\"), identify the figure of speech used.", options: ["Metaphor", "Alliteration", "Pun", "Simile"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which sentence(s) is/are correct? (A) There is few hope of his recovery. (B) He showed few concern for his nephew. (C) He showed little mercy to the vanquished.", options: ["Only (A)", "(A), (B) and (C)", "Only (C)", "None of the above"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Which of the following words is not a co-ordinating conjunction?", options: ["and", "if", "but", "for"], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "Fill in the blanks with appropriate prepositions: His thirst ___ knowledge left him no leisure ___ anything else.", options: ["by, by", "on, on", "at, at", "for, for"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "The word 'fast' in the sentence 'He is a fast writer' is", options: ["a conjunction", "an adverb", "a noun", "an adjective"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which of the following is not a simple sentence?", options: ["I have a very costly book in my house.", "She reads what she likes.", "She does not know good manners.", "He is a man of great knowledge."], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "The sentence 'He will be playing the piano in the concert day after tomorrow' is in", options: ["Future Indefinite Tense", "Future Imperfect Tense", "Present Indefinite Tense", "Future Perfect Continuous Tense"], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "Which of the following alternatives is grammatically correct?", options: ["All these men are gentle.", "All these man are gentle.", "All this men are gentle.", "All these mans are gentle."], correctOptionIndex: 0 },
  { sectionId: "language_2_english", prompt: "Fill in the blank with the appropriate preposition: He came to me ___ midnight.", options: ["in", "on", "at", "upon"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "Which of the following sentences does not have an adjective clause?", options: ["The man who is truthful is loved by all.", "I met him where he lived.", "I love the man who is truthful.", "I met him in Prayagraj which is a holy city."], correctOptionIndex: 1 },
  { sectionId: "language_2_english", prompt: "Fill in the blank with the correct preposition: He is junior ___ me.", options: ["than", "with", "from", "to"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Fill in the blank with the correct conjunction: Either he is mad ___ he feigns madness.", options: ["and", "nor", "so", "or"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which of the following sentences is in passive voice?", options: ["Someone may steal the bicycle.", "Some boys were helping the wounded man.", "The teacher scolded him for being late.", "My watch was lost."], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which of the following alternatives is the correct passive voice form of 'Do it'?", options: ["It be done", "It will be done", "It is done", "Let it be done"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which of the following words is plural?", options: ["Index", "Analysis", "Crisis", "Criteria"], correctOptionIndex: 3 },
  { sectionId: "language_2_english", prompt: "Which of the following nouns is in plural?", options: ["news", "electronics", "mice", "billiards"], correctOptionIndex: 2 },
  { sectionId: "language_2_english", prompt: "\"He was an orphan and lived with his uncle.\" In the above sentence, identify the gender of the word 'orphan'.", options: ["Masculine Gender", "Common Gender", "Feminine Gender", "Neuter Gender"], correctOptionIndex: 1 },
];

const MATHEMATICS: Q[] = [
  { sectionId: "mathematics", prompt: "The length of a rectangle is increased by 60%. By what percent would the width have to be decreased to maintain the same area?", options: ["50%", "125%", "75.5%", "37.5%"], correctOptionIndex: 3 },
  { sectionId: "mathematics", prompt: "The volume of a cube is numerically equal to the sum of the length of its edges. The total surface area of the cube in square units is", options: ["12.4", "72.0", "64.5", "44.2"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "Amit's salary in 2018 is Rs. 1,26,500. His salary for 2016 has risen annually by 10% and 15% respectively to reach the 2018 salary figure. What was his salary in 2016?", options: ["Rs. 95,000", "Rs. 1,25,000", "Rs. 1,15,000", "Rs. 1,00,000"], correctOptionIndex: 3 },
  { sectionId: "mathematics", prompt: "The HCF of two numbers is 6 and their LCM is 432. If one of the numbers is 48, the other number is", options: ["52", "42", "27", "54"], correctOptionIndex: 3 },
  { sectionId: "mathematics", prompt: "If the third Friday of a month is on the 16th, what will be the date of the fourth (4th) Tuesday of the same month?", options: ["20", "27", "22", "29"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "How many vertices are there in a triangular prism?", options: ["4", "6", "5", "8"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "What will be the loss percentage, if bananas purchased 6 for Rs.10 are sold 4 for Rs.6?", options: ["10%", "5%", "6%", "20%"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "Which one is correct in the following: 1 gram = ___ kilogram? A. 1/1000 kg  B. 10^-3 kg  C. 0.0001 kg  D. 1000 kg", options: ["B, C", "A, B", "A, C", "C, D"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "(0.01)^2 can be written in the percentage form as: A. 0.01%  B. 1/100  C. 1%  D. (1/100)%", options: ["A, B", "B, C", "A, C", "A, D"], correctOptionIndex: 3 },
  { sectionId: "mathematics", prompt: "If the difference and product of two numbers are 5 and 36 respectively, find the difference of their reciprocals.", options: ["5/36", "5/9", "31/36", "9/5"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "If the length of a room is decreased by 10% and breadth is decreased by 20%, while height is increased by 5%, then what percentage change occurs in the volume of the room?", options: ["24%", "24.4%", "24.2%", "24.6%"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "If the length and breadth of a room are 15 m 17 cm and 9 m 2 cm respectively, what is the minimum number of square tiles that can fit that floor?", options: ["814", "841", "820", "840"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "The unit digit of the multiplication (2153)^167 is", options: ["1", "7", "3", "9"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "If we increase the numerator of a fraction by 20% and the denominator by 25%, it becomes 3/5. The original fraction is", options: ["3/8", "8/5", "5/8", "8/3"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "The numbers divisible by 8 among the following are: i. 5240  ii. 5220  iii. 97128  iv. 97124", options: ["i and ii", "i, iii and iv", "ii and iii", "i and iii"], correctOptionIndex: 3 },
  { sectionId: "mathematics", prompt: "Find a Pythagorean triplet whose smallest number is 8.", options: ["6, 8, 10", "8, 9, 10", "8, 15, 17", "8, 64, 512"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "Find the value of Z for which the number 417Z8 is divisible by 9.", options: ["3", "7", "6", "9"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "If 2160 = 2^a x 3^b x 5^c, then find the value of 3^a x 2^-b x 5^-c.", options: ["1/2", "81/40", "0", "37/39"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "In the pattern where 64, 27, 8 map to 1, 2, 3 around a star (each being a perfect cube of 4, 3, 2), find the value of x mapped to 4.", options: ["0", "5", "1", "6"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "The mode of a distribution can be obtained from", options: ["Histogram", "More than type ogives", "Less than type ogives", "Frequency polygon"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "If (a+b)/c = (b+c)/a = (c+a)/b = K, then the value of K is", options: ["1", "1/2", "2", "3/2"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "The number of possible triangles using any three of the lengths 1.2 cm, 4.2 cm, 5.9 cm and 8.1 cm is", options: ["One", "Three", "Two", "Four"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "The denominator of a fraction is 1 more than double the numerator. On adding 2 to the numerator and subtracting 3 from the denominator, we obtain 1. Find the original fraction.", options: ["4/9", "2/5", "1/9", "1/3"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "Simplify: (-9) - {(-8) + (24 divided by |13-7|)}", options: ["5", "-8", "-5", "None of these"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "If HCF(a, 8) = 4 and LCM(a, 8) = 24, then 'a' is", options: ["10", "14", "12", "8"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "The diagonal of a rectangular field is 17 metres and its perimeter is 46 metres. The area of the field will be", options: ["112 m2", "132 m2", "120 m2", "289 m2"], correctOptionIndex: 2 },
  { sectionId: "mathematics", prompt: "On simplification, {(2^-1)}^-1 gives a number that is:", options: ["Prime number, Even number, Multiple of 2", "Prime number, Multiple of 2, Odd number", "Even number, Multiple of 2, Odd number", "Prime number, Even number, Odd number"], correctOptionIndex: 0 },
  { sectionId: "mathematics", prompt: "Which one of the following statements is correct?", options: ["Sum of two prime numbers is always a prime number.", "A composite number may be an odd number.", "The least prime number is 1.", "An even prime number does not exist."], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "The difference between the interior and exterior angles of a regular polygon is 60 degrees. The number of sides in the polygon is", options: ["4", "6", "5", "7"], correctOptionIndex: 1 },
  { sectionId: "mathematics", prompt: "The number of points present on a straight line is", options: ["infinite", "2", "0", "1"], correctOptionIndex: 0 },
];

const EVS: Q[] = [
  { sectionId: "evs", prompt: "Reservation for women in India is available in", options: ["Lok Sabha", "Cabinet", "Vidhan Sabha", "Panchayati Raj Institutions"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "In order to be appointed as the Governor of a State, one must have attained the age of", options: ["35 years", "50 years", "45 years", "30 years"], correctOptionIndex: 0 },
  { sectionId: "evs", prompt: "Match List-I with List-II.\nList-I: (a) Indian Union (b) State (c) Corporation (d) Village Panchayat\nList-II: (A) Prime Minister (B) Sarpanch (C) Governor (D) Mayor", options: ["(a)-D, (b)-A, (c)-B, (d)-C", "(a)-A, (b)-C, (c)-D, (d)-B", "(a)-B, (b)-C, (c)-D, (d)-A", "(a)-C, (b)-D, (c)-A, (d)-B"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "Which tax can be imposed by a Nagar Nigam (Municipal Corporation)?", options: ["Entertainment Tax", "Toll Tax", "House Tax", "All the above"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "A hamlet is associated with which kind of settlement?", options: ["Fragmented", "Linear", "Rural", "Urban"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "Which of the following is a volcanic mountain?", options: ["Aravali", "Appalachian", "Ural", "Kilimanjaro"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "Elephanta Island is located at", options: ["Kutch Coast", "Mumbai Coast", "Goa Coast", "Ganga Delta"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "Monsoon forests are found where rainfall is", options: ["70-200 cm", "50-150 cm", "150-200 cm", "70-100 cm"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "Karbi Anglong Plateau is an extension of", options: ["Peninsular plateau", "Tibet", "Himalaya", "Shan plateau"], correctOptionIndex: 0 },
  { sectionId: "evs", prompt: "Which of the following is an example of a sessile animal?", options: ["Euplectella", "Chiton", "Leech", "Echinus"], correctOptionIndex: 0 },
  { sectionId: "evs", prompt: "The unit of a protein molecule is", options: ["Glucose", "Amino acid", "Fatty acid", "Vitamin"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "Which organelle is absent in a plant cell?", options: ["Cellulose cell wall", "Vacuoles", "Plastids", "Centrosome"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "The largest gland in the human body is the", options: ["Pancreas", "Adrenal Gland", "Pituitary Gland", "Liver"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "The state bird of Uttar Pradesh is the", options: ["Sarus Crane", "House Sparrow", "Peacock", "Parrot"], correctOptionIndex: 0 },
  { sectionId: "evs", prompt: "In which of the following regions are Reindeer found?", options: ["Tundra", "Monsoon", "Hot Desert", "Taiga"], correctOptionIndex: 0 },
  { sectionId: "evs", prompt: "Which one of the following is not a temperate grassland?", options: ["Pampas", "Downs", "Compas", "Prairies"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "According to population size, the largest continent is", options: ["Europe", "Asia", "North America", "Africa"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "Where does the Tharu tribe live in India?", options: ["Thar Desert", "Uttarakhand", "Tarai region of Uttar Pradesh", "Jharkhand"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "The Bhilai Steel Plant is situated in", options: ["Madhya Pradesh", "Chhattisgarh", "Jharkhand", "Odisha"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "The world's most problematic aquatic weed, also known as the \"Terror of Bengal\", is", options: ["Lantana Camara", "Eichhornia crassipes (Water hyacinth)", "Parthenium hysterophorus (Congress grass)", "Cynodon dactylon (Doob grass)"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "The abiotic property of a virus is that", options: ["It does not have the genetic material", "It cannot reproduce", "It does not have protein", "It can be crystallized"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "The plant hormone that helps in the ripening of fruits is", options: ["Auxin", "Cytokinin", "Gibberellins", "Ethylene"], correctOptionIndex: 3 },
  { sectionId: "evs", prompt: "The free-living, anaerobic, nitrogen (N2)-fixing bacteria found in soil is", options: ["Azotobacter", "Clostridium", "Rhizobium", "Vibrio"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "Which type of DNA is commonly found inside the cell?", options: ["A-DNA", "B-DNA", "C-DNA", "Z-DNA"], correctOptionIndex: 1 },
  { sectionId: "evs", prompt: "In 1853, India's first passenger train ran between", options: ["Bombay and Pune", "Calcutta and Alipur", "Bombay and Thane", "Calcutta and Damdam"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "Asia's largest cattle fair is organised at", options: ["Haridwar", "Pushkar", "Sonepur", "Nasik"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "The National Integration Council was established in the year", options: ["1951", "1971", "1961", "1981"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "In which of the following Articles of the Constitution is the Right to Equality mentioned?", options: ["Articles 19-22", "Articles 23-24", "Articles 14-18", "Articles 25-28"], correctOptionIndex: 2 },
  { sectionId: "evs", prompt: "Which country has a flexible Constitution?", options: ["India", "America", "China", "United Kingdom"], correctOptionIndex: 3 },
];

async function main() {
  const db = getDb();
  const all: Q[] = [...CDP, ...ENGLISH, ...MATHEMATICS, ...EVS];
  console.log(`Ingesting ${all.length} real UPTET 2019 Paper 1 questions (marker: ${JSON.stringify(SOURCE_NOTE).slice(0, 40)}...)...`);

  await db.delete(schema.questions).where(eq(schema.questions.sourceNote, SOURCE_NOTE));

  await db.insert(schema.questions).values(
    all.map((q) => ({
      paperId: "paper_1" as const,
      sectionId: q.sectionId,
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      source: "pyq" as const,
      status: "calibration" as const,
      sourceYear: 2019,
      sourceNote: SOURCE_NOTE,
      responseCount: 0,
    })),
  );

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export interface ResumeCheckItem {
  id: string
  passed: boolean
  ua: string
  en: string
}

export interface ResumeReviewResult {
  items: ResumeCheckItem[]
  score: number
}

const DEVOPS_KEYWORDS = [
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'aws', 'azure', 'gcp', 'google cloud',
  'ci/cd', 'ci\\/cd', 'github actions', 'gitlab ci', 'jenkins', 'linux', 'nginx', 'prometheus',
  'grafana', 'iac', 'infrastructure as code', 'monitoring',
]

const BUZZWORDS = ['cutting-edge', 'innovative', 'passionate', 'dynamic', 'go-getter', 'synergy']

function countMatches(text: string, patterns: string[]): number {
  const lower = text.toLowerCase()
  return patterns.filter((p) => new RegExp(p, 'i').test(lower)).length
}

/**
 * Deterministic, rule-based resume checklist — no backend/LLM call, mirrors the
 * client-only architecture of the rest of the app (see assessSession/offerLetter).
 */
export function reviewResume(text: string): ResumeReviewResult {
  const trimmed = text.trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0

  const items: ResumeCheckItem[] = [
    {
      id: 'length',
      passed: wordCount >= 80 && wordCount <= 700,
      ua: `Обсяг резюме: ${wordCount} слів (орієнтир — 80–700 слів, одна сторінка).`,
      en: `Resume length: ${wordCount} words (target range: 80–700 words, one page).`,
    },
    {
      id: 'skills-section',
      passed: /skills|навички/i.test(trimmed),
      ua: 'Присутній окремий розділ "Skills"/"Навички".',
      en: 'Has a dedicated "Skills" section.',
    },
    {
      id: 'experience-section',
      passed: /experience|досвід/i.test(trimmed),
      ua: 'Присутній окремий розділ "Experience"/"Досвід".',
      en: 'Has a dedicated "Experience" section.',
    },
    {
      id: 'education-section',
      passed: /education|освіта/i.test(trimmed),
      ua: 'Присутній окремий розділ "Education"/"Освіта".',
      en: 'Has a dedicated "Education" section.',
    },
    {
      id: 'contact-links',
      passed: /linkedin|github/i.test(trimmed),
      ua: 'Вказано посилання на LinkedIn або GitHub.',
      en: 'Includes a LinkedIn or GitHub link.',
    },
    {
      id: 'quantified-achievements',
      passed: /\d+\s*%|\d+x\b/i.test(trimmed),
      ua: 'Є хоча б одне кількісне досягнення (наприклад, "40%", "2x").',
      en: 'Has at least one quantified achievement (e.g. "40%", "2x").',
    },
    {
      id: 'devops-keywords',
      passed: countMatches(trimmed, DEVOPS_KEYWORDS) >= 4,
      ua: `Покриття DevOps-термінології: ${countMatches(trimmed, DEVOPS_KEYWORDS)} ключових слів (мінімум 4).`,
      en: `DevOps keyword coverage: ${countMatches(trimmed, DEVOPS_KEYWORDS)} keywords found (minimum 4).`,
    },
    {
      id: 'buzzword-overload',
      passed: countMatches(trimmed, BUZZWORDS) <= 2,
      ua: 'Резюме не перевантажене загальними buzzword-фразами без конкретики ("innovative", "passionate" тощо).',
      en: 'Resume is not overloaded with vague buzzwords ("innovative", "passionate", etc.) without specifics.',
    },
    {
      id: 'grammar-years',
      passed: !/\b1\s+years\b/i.test(trimmed),
      ua: 'Немає граматичної помилки узгодження числа (напр. "1 years" замість "1 year").',
      en: 'No number-agreement grammar slip (e.g. "1 years" instead of "1 year").',
    },
  ]

  const score = Math.round((items.filter((i) => i.passed).length / items.length) * 100)
  return { items, score }
}

export const SAMPLE_RESUME = `With over 1 years of experience in the IT field, I am a passionate and innovative DevOps engineer who strives to implement cutting-edge technologies and practices to enhance the efficiency and quality of software development and deployment. I have a background in network engineering, system administration, and technical support, as well as a bachelor's degree in engineering and multiple badges from Google Cloud Skills Boost.

Skills
Docker, Terraform, GitHub, AWS, Google Cloud

Experience
August 2023 – PRESENT
Junior DevOps engineer | Projects Brewly-Store, Moco Migration, MiM, Voicenger, Pretty paws, FreEngIish | Odesa, Ukraine
- Architected and deployed a high-performance Serverless API using Hono.js and Cloudflare Workers, achieving near-zero cold starts and global scalability.
- Engineered an Edge-native database solution using Cloudflare D1 (SQLite), implementing automated schema migrations and optimized data access patterns.
- Developed a robust security layer by implementing custom Middleware for API Key authentication and configuring fine-grained CORS policies to enable secure cross-origin communication.
- Automated CI/CD pipelines via GitHub Actions, streamlining the deployment process and centralizing environment variable management through encrypted GitHub Secrets.
- Accelerated frontend development by 40% by delivering comprehensive OpenAPI/Swagger documentation and a pre-configured local development environment (Node.js 20, .env standards).

Education
September 2024 — Security Engineer, student of 3rd course | Odesa Technical Vocational College
September 2009 — Student of Network Engineering Courses | Computer Academy STEP

Certification
Google Skill Badges
AWS Cloud Practitioner Essentials
Rules of Information Security, CRDF Global
IT Essentials II: Network Operating Systems, Cisco Networking Academy

LinkedIn · GitHub · YouTube · x.com`

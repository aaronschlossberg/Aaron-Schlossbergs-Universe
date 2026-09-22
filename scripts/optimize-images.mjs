import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

const jobs = [
    {
        input: "assets/img/me_nachi_falls_circular.png",
        output: "assets/img/me_nachi_falls_circular-320.webp",
        width: 320,
        height: 320,
        fit: "cover",
        position: "centre",
        quality: 82
    },
    {
        input: "assets/img/education/education_with_chalkboard_and_desk.jpg",
        output: "assets/img/education/education_with_chalkboard_and_desk-820.webp",
        width: 820,
        height: 460,
        fit: "inside",
        quality: 80
    },
    {
        input: "assets/img/Backrooms_testing_in_Blender.png",
        output: "assets/img/projects/fiction2reality/backrooms-blender-1280.webp",
        width: 1280,
        height: 720,
        fit: "cover",
        position: "centre",
        quality: 82
    },
    {
        input: "assets/img/projects/fiction2reality/fiction2reality-homepage.png",
        output: "assets/img/projects/fiction2reality/fiction2reality-homepage-1280.webp",
        width: 1280,
        height: 720,
        fit: "cover",
        position: "centre",
        quality: 82
    },
    ...[
        "empty_company_card.jpeg",
        "entrepreneur_aaron_old.jpeg",
        "documenting_your_ideas_faucet.jpeg",
        "bonsai.jpeg",
        "breaking_generational_trauma.jpeg",
        "students_on_campus_muhlenberg_website_aaron.jpg",
        "students_on_trexler_library_stairs_muhlenberg_website_aaron.jpg",
        "students_in_red_chairs_muhlenberg_website_aaron.jpg"
    ].map((filename) => ({
        input: `assets/img/highlights_images/${filename}`,
        output: `assets/img/highlights_images/${path.parse(filename).name}.webp`,
        width: 640,
        height: 360,
        fit: "cover",
        position: "attention",
        quality: 80
    }))
];

for (const job of jobs) {
    const input = path.join(SITE_ROOT, job.input);
    const output = path.join(SITE_ROOT, job.output);

    await mkdir(path.dirname(output), { recursive: true });

    await sharp(input)
        .rotate()
        .resize({
            width: job.width,
            height: job.height,
            fit: job.fit,
            position: job.position
        })
        .webp({
            quality: job.quality,
            effort: 6
        })
        .toFile(output);

    console.log(`Optimized ${job.output}`);
}

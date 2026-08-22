/**
 * The workflow used when you haven't supplied one.
 *
 * This is ComfyUI's own default text-to-image graph in API format — the
 * one its "Load Default" button gives you — with the prompt, seed and
 * size left for the queue to fill in.
 *
 * It is a TypeScript constant rather than a file in data/ for two
 * reasons: data/ is gitignored, so a fresh clone would have no workflow
 * at all; and a .json next to this file would not be copied into dist/
 * by tsc, so the built server would lose it.
 *
 * The checkpoint name is the one thing here that is a guess about YOUR
 * machine, and it is the usual failure: ComfyUI answers, and then
 * refuses the graph because it has no sd_xl_base_1.0.safetensors. That
 * refusal comes back with ComfyUI's own words about which node is
 * wrong, which is the moment to export your own workflow with
 * Save (API format) and point COMFYUI_WORKFLOW at it.
 */
export const DEFAULT_WORKFLOW = {
    "4": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: process.env.COMFYUI_CHECKPOINT || "sd_xl_base_1.0.safetensors" },
    },
    "5": {
        class_type: "EmptyLatentImage",
        inputs: { width: 1024, height: 1024, batch_size: 1 },
    },
    "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: "", clip: ["4", 1] },
    },
    "7": {
        class_type: "CLIPTextEncode",
        inputs: { text: "text, watermark, blurry, low quality", clip: ["4", 1] },
    },
    "3": {
        class_type: "KSampler",
        inputs: {
            seed: 0,
            steps: 20,
            cfg: 8,
            sampler_name: "euler",
            scheduler: "normal",
            denoise: 1,
            model: ["4", 0],
            positive: ["6", 0],
            negative: ["7", 0],
            latent_image: ["5", 0],
        },
    },
    "8": {
        class_type: "VAEDecode",
        inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
        class_type: "SaveImage",
        inputs: { filename_prefix: "KIWI", images: ["8", 0] },
    },
} as const;

/**
 * Next config.
 *
 * `distDir` is overridable so a second dev server (a verification run, say)
 * can be pointed at its own build directory. Two servers sharing `.next`
 * corrupt each other: the second one rewrites the chunks while the first
 * still holds the old manifest in memory, and every route on the first
 * starts answering 500 until it is restarted.
 *
 *   GM_DIST_DIR=.next-verify npx next dev -p 3001
 */
const nextConfig = {
  distDir: process.env.GM_DIST_DIR || ".next",
};

export default nextConfig;

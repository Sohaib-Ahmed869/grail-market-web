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

  /* The dev overlay's badge lands on top of the admin topbar's avatar — the
     control that opens Settings and sign-out — and `position` did not move it
     (measured at 1444,20 against the avatar at 1434,16). Off in development
     rather than covering a control; delete this line to bring it back. */
  devIndicators: false,

  /* The verification queue and the listing queue were the same queue read
     from two places. They are one page now; this keeps every link, bookmark
     and note that still says /admin/verification pointing at it. */
  async redirects() {
    return [{ source: "/admin/verification", destination: "/admin/listings", permanent: true }];
  },
};

export default nextConfig;

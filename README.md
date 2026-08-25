# grail-market-web

The web client. Photograph a card — or search for one by name — and see what it
is worth, where that figure came from, and how much to trust it.

## Running it

```bash
npm install
cp .env.example .env.local        # point it at your backend
npm run dev                       # http://localhost:3000
```

It needs `grail-market-backend` running. With the backend down the page loads
and every scan and search fails, which is the honest failure but not a useful
one.

## One environment variable

`NEXT_PUBLIC_API_URL` — the backend's address. It is read at **build** time, so
changing it means rebuilding, not restarting. Nothing else is needed here: no
API keys live in the browser, and none should.

## Layout

```
app/
  page.tsx      the whole client. Scan flow, search, price display, currency.
  globals.css   the design system, such as it is
  layout.tsx    fonts and the document shell
```

One file is a lot for `page.tsx`, and it is the next thing worth splitting. It
holds the capture slots, the scan pipeline UI, the price hero, the grader tabs,
live listings, and search — each of which is a component's worth of work.

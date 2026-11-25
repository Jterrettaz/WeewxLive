# Change log — weewx-live

*Version française : [changelog.fr.md](changelog.fr.md).*

## 1.3

- NOAA reports (text) for every month and year (`NOAA/NOAA-YYYY-MM.txt`, `NOAA-YYYY.txt`), shown by the new "Climatology" → "NOAA reports" page; option `noaa` of `[[archives]]`.
- Documentation: short installation guide in `README.md` / `README.fr.md`; the full documentation moves to `docs/manual.md` / `docs/manual.fr.md`.

## 1.2

- "Sun and Moon": sun path in the sky (direction / altitude) to the right of the altitude chart: today, 21 June, equinox, 21 December, moon from rise to set.
- "Rearrange": "Expand" / "Collapse" button on each measurement panel.
- Dashboard profiles: while rearranging, the layout (order and visibility of frames and panels)
  and the expanded / collapsed state of each panel can be saved under a name; a "Profile" list at
  the top of the dashboard applies a saved profile. The administrator can offer station profiles
  to all visitors (`[[dashboard]] [[[profiles]]]`).
- Colour themes (`theme.css`: Classic, Navy,Grassland,  Slate, Forest) and "Settings → Appearance" page:
  each visitor chooses the light / dark mode and the colour theme (remembered by their browser).
  Site default: `[LiveJSON] [[appearance]]`; theme names: `[Texts] [[Themes]]` of the language files.

## 1.0

- Final release.

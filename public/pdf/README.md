# PDF design assets

- `template-background.jpg`: faint map background extracted from page 3 of the user-supplied `ProjectName_Fotobrief-Photobrief_v1_Plyo.pdf`, used to reproduce its layout. Example project content and authoring directions are not included.
- `plyo-logo.png`: raster export of the existing `public/brand/plyo-logo-light.svg` logo, prepared for embedding in the PDF.
- `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`: Noto Sans fonts from the [official Noto fonts repository](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans), distributed under the SIL Open Font License in `OFL.txt`. These are embedded as subsets and support Norwegian characters.

The application loads these assets from its own deployment when PDF export starts. Keep the license with the font files.

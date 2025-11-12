# Installing Webfonts
Follow these simple Steps.

## 1.
Put `bespoke-slab/` Folder into a Folder called `fonts/`.

## 2.
Put `bespoke-slab.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `bespoke-slab.css` depends on your Website Filesystem.

## 4.
Import `bespoke-slab.css` at the top of you main Stylesheet.

```
@import url('bespoke-slab.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: BespokeSlab-Light;
font-family: BespokeSlab-LightItalic;
font-family: BespokeSlab-Regular;
font-family: BespokeSlab-Italic;
font-family: BespokeSlab-Medium;
font-family: BespokeSlab-MediumItalic;
font-family: BespokeSlab-Bold;
font-family: BespokeSlab-BoldItalic;
font-family: BespokeSlab-Extrabold;
font-family: BespokeSlab-ExtraboldItalic;
font-family: BespokeSlab-Variable;
font-family: BespokeSlab-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 800.0

Available axes:
'wght' (range from 300.0 to 800.0


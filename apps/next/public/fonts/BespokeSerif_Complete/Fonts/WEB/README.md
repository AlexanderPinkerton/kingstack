# Installing Webfonts
Follow these simple Steps.

## 1.
Put `bespoke-serif/` Folder into a Folder called `fonts/`.

## 2.
Put `bespoke-serif.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `bespoke-serif.css` depends on your Website Filesystem.

## 4.
Import `bespoke-serif.css` at the top of you main Stylesheet.

```
@import url('bespoke-serif.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: BespokeSerif-Light;
font-family: BespokeSerif-LightItalic;
font-family: BespokeSerif-Regular;
font-family: BespokeSerif-Italic;
font-family: BespokeSerif-Medium;
font-family: BespokeSerif-MediumItalic;
font-family: BespokeSerif-Bold;
font-family: BespokeSerif-BoldItalic;
font-family: BespokeSerif-Extrabold;
font-family: BespokeSerif-ExtraboldItalic;
font-family: BespokeSerif-Variable;
font-family: BespokeSerif-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 300.0wght 800.0

Available axes:
'wght' (range from 300.0 to 800.0'wght' (range from 300.0 to 800.0


# Installing Webfonts
Follow these simple Steps.

## 1.
Put `bevellier/` Folder into a Folder called `fonts/`.

## 2.
Put `bevellier.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `bevellier.css` depends on your Website Filesystem.

## 4.
Import `bevellier.css` at the top of you main Stylesheet.

```
@import url('bevellier.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Bevellier-Thin;
font-family: Bevellier-ThinItalic;
font-family: Bevellier-Extralight;
font-family: Bevellier-ExtralightItalic;
font-family: Bevellier-Light;
font-family: Bevellier-LightItalic;
font-family: Bevellier-Regular;
font-family: Bevellier-Italic;
font-family: Bevellier-Medium;
font-family: Bevellier-MediumItalic;
font-family: Bevellier-Semibold;
font-family: Bevellier-SemiboldItalic;
font-family: Bevellier-Bold;
font-family: Bevellier-BoldItalic;
font-family: Bevellier-Black;
font-family: Bevellier-BlackItalic;
font-family: Bevellier-Variable;
font-family: Bevellier-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 100.0

Available axes:
'wght' (range from 100.0 to 900.0


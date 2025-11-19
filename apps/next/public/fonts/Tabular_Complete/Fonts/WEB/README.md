# Installing Webfonts
Follow these simple Steps.

## 1.
Put `tabular/` Folder into a Folder called `fonts/`.

## 2.
Put `tabular.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `tabular.css` depends on your Website Filesystem.

## 4.
Import `tabular.css` at the top of you main Stylesheet.

```
@import url('tabular.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Tabular-Light;
font-family: Tabular-LightItalic;
font-family: Tabular-Regular;
font-family: Tabular-Italic;
font-family: Tabular-Medium;
font-family: Tabular-MediumItalic;
font-family: Tabular-Semibold;
font-family: Tabular-SemiboldItalic;
font-family: Tabular-Bold;
font-family: Tabular-BoldItalic;
font-family: Tabular-Variable;
font-family: Tabular-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 700.0

Available axes:
'wght' (range from 300.0 to 700.0


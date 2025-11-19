# Installing Webfonts
Follow these simple Steps.

## 1.
Put `recia/` Folder into a Folder called `fonts/`.

## 2.
Put `recia.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `recia.css` depends on your Website Filesystem.

## 4.
Import `recia.css` at the top of you main Stylesheet.

```
@import url('recia.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Recia-Light;
font-family: Recia-LightItalic;
font-family: Recia-Regular;
font-family: Recia-Italic;
font-family: Recia-Medium;
font-family: Recia-MediumItalic;
font-family: Recia-Semibold;
font-family: Recia-SemiboldItalic;
font-family: Recia-Bold;
font-family: Recia-BoldItalic;
font-family: Recia-Variable;
font-family: Recia-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 300.0wght 700.0

Available axes:
'wght' (range from 300.0 to 700.0'wght' (range from 300.0 to 700.0


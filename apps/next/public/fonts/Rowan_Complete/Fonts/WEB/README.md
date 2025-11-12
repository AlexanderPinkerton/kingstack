# Installing Webfonts
Follow these simple Steps.

## 1.
Put `rowan/` Folder into a Folder called `fonts/`.

## 2.
Put `rowan.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `rowan.css` depends on your Website Filesystem.

## 4.
Import `rowan.css` at the top of you main Stylesheet.

```
@import url('rowan.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Rowan-Light;
font-family: Rowan-LightItalic;
font-family: Rowan-Regular;
font-family: Rowan-Italic;
font-family: Rowan-Medium;
font-family: Rowan-MediumItalic;
font-family: Rowan-Semibold;
font-family: Rowan-SemiboldItalic;
font-family: Rowan-Bold;
font-family: Rowan-BoldItalic;
font-family: Rowan-Variable;
font-family: Rowan-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 700.0

Available axes:
'wght' (range from 300.0 to 700.0


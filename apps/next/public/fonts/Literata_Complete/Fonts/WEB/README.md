# Installing Webfonts
Follow these simple Steps.

## 1.
Put `literata/` Folder into a Folder called `fonts/`.

## 2.
Put `literata.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `literata.css` depends on your Website Filesystem.

## 4.
Import `literata.css` at the top of you main Stylesheet.

```
@import url('literata.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Literata-ExtraLight;
font-family: Literata-ExtraLightItalic;
font-family: Literata-Light;
font-family: Literata-LightItalic;
font-family: Literata-Regular;
font-family: Literata-Italic;
font-family: Literata-Medium;
font-family: Literata-MediumItalic;
font-family: Literata-SemiBold;
font-family: Literata-SemiBoldItalic;
font-family: Literata-Bold;
font-family: Literata-BoldItalic;
font-family: Literata-ExtraBold;
font-family: Literata-ExtraBoldItalic;
font-family: Literata-Black;
font-family: Literata-BlackItalic;
font-family: Literata-Variable;
font-family: Literata-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 900.0opsz 7.0

Available axes:
'wght' (range from 200.0 to 900.0'opsz' (range from 7.0 to 72.0


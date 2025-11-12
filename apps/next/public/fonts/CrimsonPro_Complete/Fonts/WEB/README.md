# Installing Webfonts
Follow these simple Steps.

## 1.
Put `crimson-pro/` Folder into a Folder called `fonts/`.

## 2.
Put `crimson-pro.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `crimson-pro.css` depends on your Website Filesystem.

## 4.
Import `crimson-pro.css` at the top of you main Stylesheet.

```
@import url('crimson-pro.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: CrimsonPro-ExtraLight;
font-family: CrimsonPro-ExtraLightItalic;
font-family: CrimsonPro-Light;
font-family: CrimsonPro-LightItalic;
font-family: CrimsonPro-Regular;
font-family: CrimsonPro-Italic;
font-family: CrimsonPro-Medium;
font-family: CrimsonPro-MediumItalic;
font-family: CrimsonPro-SemiBold;
font-family: CrimsonPro-SemiBoldItalic;
font-family: CrimsonPro-Bold;
font-family: CrimsonPro-BoldItalic;
font-family: CrimsonPro-ExtraBold;
font-family: CrimsonPro-ExtraBoldItalic;
font-family: CrimsonPro-Black;
font-family: CrimsonPro-BlackItalic;
font-family: CrimsonPro-Variable;
font-family: CrimsonPro-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 400.0

Available axes:
'wght' (range from 200.0 to 900.0


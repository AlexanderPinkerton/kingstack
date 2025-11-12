# Installing Webfonts
Follow these simple Steps.

## 1.
Put `azeret-mono/` Folder into a Folder called `fonts/`.

## 2.
Put `azeret-mono.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `azeret-mono.css` depends on your Website Filesystem.

## 4.
Import `azeret-mono.css` at the top of you main Stylesheet.

```
@import url('azeret-mono.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: AzeretMono-Thin;
font-family: AzeretMono-ThinItalic;
font-family: AzeretMono-ExtraLight;
font-family: AzeretMono-ExtraLightItalic;
font-family: AzeretMono-Light;
font-family: AzeretMono-LightItalic;
font-family: AzeretMono-Regular;
font-family: AzeretMono-Italic;
font-family: AzeretMono-Medium;
font-family: AzeretMono-MediumItalic;
font-family: AzeretMono-SemiBold;
font-family: AzeretMono-SemiBoldItalic;
font-family: AzeretMono-Bold;
font-family: AzeretMono-BoldItalic;
font-family: AzeretMono-ExtraBold;
font-family: AzeretMono-ExtraBoldItalic;
font-family: AzeretMono-Black;
font-family: AzeretMono-BlackItalic;
font-family: AzeretMono-Variable;
font-family: AzeretMono-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 100.0

Available axes:
'wght' (range from 100.0 to 900.0


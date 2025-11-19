# Installing Webfonts
Follow these simple Steps.

## 1.
Put `boska/` Folder into a Folder called `fonts/`.

## 2.
Put `boska.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `boska.css` depends on your Website Filesystem.

## 4.
Import `boska.css` at the top of you main Stylesheet.

```
@import url('boska.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Boska-Extralight;
font-family: Boska-ExtralightItalic;
font-family: Boska-Light;
font-family: Boska-LightItalic;
font-family: Boska-Regular;
font-family: Boska-Italic;
font-family: Boska-Medium;
font-family: Boska-MediumItalic;
font-family: Boska-Bold;
font-family: Boska-BoldItalic;
font-family: Boska-Black;
font-family: Boska-BlackItalic;
font-family: Boska-Variable;
font-family: Boska-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 200.0

Available axes:
'wght' (range from 200.0 to 900.0


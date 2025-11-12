# Installing Webfonts
Follow these simple Steps.

## 1.
Put `chubbo/` Folder into a Folder called `fonts/`.

## 2.
Put `chubbo.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `chubbo.css` depends on your Website Filesystem.

## 4.
Import `chubbo.css` at the top of you main Stylesheet.

```
@import url('chubbo.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Chubbo-Extralight;
font-family: Chubbo-ExtralightItalic;
font-family: Chubbo-Light;
font-family: Chubbo-LightItalic;
font-family: Chubbo-Regular;
font-family: Chubbo-Italic;
font-family: Chubbo-Medium;
font-family: Chubbo-MediumItalic;
font-family: Chubbo-Bold;
font-family: Chubbo-BoldItalic;
font-family: Chubbo-Variable;
font-family: Chubbo-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 400.0wght 700.0

Available axes:
'wght' (range from 200.0 to 700.0'wght' (range from 200.0 to 700.0


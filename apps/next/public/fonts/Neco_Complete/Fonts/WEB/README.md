# Installing Webfonts
Follow these simple Steps.

## 1.
Put `neco/` Folder into a Folder called `fonts/`.

## 2.
Put `neco.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `neco.css` depends on your Website Filesystem.

## 4.
Import `neco.css` at the top of you main Stylesheet.

```
@import url('neco.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Neco-Regular;
font-family: Neco-Italic;
font-family: Neco-Medium;
font-family: Neco-MediumItalic;
font-family: Neco-Bold;
font-family: Neco-BoldItalic;
font-family: Neco-Black;
font-family: Neco-BlackItalic;
font-family: Neco-Variable;
font-family: Neco-VariableItalic;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 900.0

Available axes:
'wght' (range from 400.0 to 900.0


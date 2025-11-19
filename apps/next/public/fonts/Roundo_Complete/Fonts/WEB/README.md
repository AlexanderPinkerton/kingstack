# Installing Webfonts
Follow these simple Steps.

## 1.
Put `roundo/` Folder into a Folder called `fonts/`.

## 2.
Put `roundo.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `roundo.css` depends on your Website Filesystem.

## 4.
Import `roundo.css` at the top of you main Stylesheet.

```
@import url('roundo.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Roundo-ExtraLight;
font-family: Roundo-Light;
font-family: Roundo-Regular;
font-family: Roundo-Medium;
font-family: Roundo-SemiBold;
font-family: Roundo-Bold;
font-family: Roundo-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 200.0

Available axes:
'wght' (range from 200.0 to 700.0


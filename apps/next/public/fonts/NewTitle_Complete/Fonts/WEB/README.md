# Installing Webfonts
Follow these simple Steps.

## 1.
Put `new-title/` Folder into a Folder called `fonts/`.

## 2.
Put `new-title.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `new-title.css` depends on your Website Filesystem.

## 4.
Import `new-title.css` at the top of you main Stylesheet.

```
@import url('new-title.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: NewTitle-Extralight;
font-family: NewTitle-Light;
font-family: NewTitle-Regular;
font-family: NewTitle-Medium;
font-family: NewTitle-Bold;
font-family: NewTitle-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 200.0

Available axes:
'wght' (range from 200.0 to 700.0


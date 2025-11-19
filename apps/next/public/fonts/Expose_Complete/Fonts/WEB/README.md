# Installing Webfonts
Follow these simple Steps.

## 1.
Put `expose/` Folder into a Folder called `fonts/`.

## 2.
Put `expose.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `expose.css` depends on your Website Filesystem.

## 4.
Import `expose.css` at the top of you main Stylesheet.

```
@import url('expose.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Expose-Regular;
font-family: Expose-Medium;
font-family: Expose-Bold;
font-family: Expose-Black;
font-family: Expose-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 400.0

Available axes:
'wght' (range from 400.0 to 900.0


# Installing Webfonts
Follow these simple Steps.

## 1.
Put `pally/` Folder into a Folder called `fonts/`.

## 2.
Put `pally.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `pally.css` depends on your Website Filesystem.

## 4.
Import `pally.css` at the top of you main Stylesheet.

```
@import url('pally.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Pally-Regular;
font-family: Pally-Medium;
font-family: Pally-Bold;
font-family: Pally-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 700.0

Available axes:
'wght' (range from 400.0 to 700.0


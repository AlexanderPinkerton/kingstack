# Installing Webfonts
Follow these simple Steps.

## 1.
Put `excon/` Folder into a Folder called `fonts/`.

## 2.
Put `excon.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `excon.css` depends on your Website Filesystem.

## 4.
Import `excon.css` at the top of you main Stylesheet.

```
@import url('excon.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Excon-Thin;
font-family: Excon-Light;
font-family: Excon-Regular;
font-family: Excon-Medium;
font-family: Excon-Bold;
font-family: Excon-Black;
font-family: Excon-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 900.0

Available axes:
'wght' (range from 100.0 to 900.0


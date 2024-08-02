# MyWebstrates

This is the code repo for MyWebstrates which will be presented at [UIST 2024](https://uist.acm.org/2024/) in Pittsburgh Oct. 13-16 2024. Documentation will be released at the latest for the conference. 

# Paper & Video
[Research paper (pdf)](https://cs.au.dk/~clemens/files/MyWebstrates-UIST2024.pdf)

[![Watch the accompanying video on YouTube](https://img.youtube.com/vi/uHVsZs4HfAw/0.jpg)](https://www.youtube.com/watch?v=uHVsZs4HfAw)

# Public hosting
There's a public hosting of MyWebstrates at [my.webstrates.net](https://my.webstrates.net).

# To build:
```bash
yarn install
yarn build # or yarn watch for development
```

# To run:
Start a webserver in the `dist` directory. For example:
```bash
cd dist
python3 -m http.server 3333
```
Then open your browser to `http://localhost:3333`

You can create a new strate with `http://localhost:3333/new`

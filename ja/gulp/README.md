# gulp

> この文章は[gulp](http://gulpjs.com/ "gulp") 3.9.0を元に書かれています。

[gulp](http://gulpjs.com/ "gulp")はNode.jsを使ったタスク自動化ツールです。
ビルドやテストなどといったタスクを実行するためのツールで、
それぞれのタスクをJavaScriptで書くことができるようになっています。

タスクは複数の処理の実行順序を定義したものとなっていて、APIとしては`gulp.task`が用意されています。
また、それぞれの処理はNode.jsの[Stream](https://nodejs.org/api/stream.html "Stream")として実装することで、
処理をStreamでつなげる(`pipe`)することができ、複数の処理を一時ファイルなしでできるようになっています。

それぞれの処理はgulpのプラグインという形でモジュール化されているため、
利用者はモジュールを読み込み、`pipe()`で繋ぐだけでタスクの定義ができるツールです。

## どう書ける?

例えば、[Sass](http://sass-lang.com/ "Sass")で書いたファイルを次のように処理したいとします。

1. `sass/*.scss`のファイルを読み込む
2. 読み込んだsassファイルを`sass`でコンパイル
3. CSSとなったファイルに`autoprefixture`で接頭辞をつける
4. CSSファイルをそれぞれ`minify`で圧縮する
5. 圧縮したCSSファイルをそれぞれ`css`ディレクトリに出力する

この一連の処理は以下のようなタスクとして定義することができます。

```js
import gulp from "gulp";
import sass from "gulp-sass";
import autoprefixer from "gulp-autoprefixer";
import minify from "gulp-minify-css";

gulp.task("sass", function() {
    return gulp.src("sass/*.scss")
        .pipe(sass())
        .pipe(autoprefixer())
        .pipe(minify())
        .pipe(gulp.dest("css"));
});
```

ここでは、gulpプラグインの仕組みについて扱うので、gulpの使い方については詳しくは以下を参照して下さい。

- [gulp/docs at master · gulpjs/gulp](https://github.com/gulpjs/gulp/tree/master/docs)
- [現場で使えるgulp入門 - gulpとは何か | CodeGrid](https://app.codegrid.net/entry/gulp-1)
- [gulp入門 (全12回) - プログラミングならドットインストール](http://dotinstall.com/lessons/basic_gulp)

## どういう仕組み?

実際にgulpプラグインを書きながら、どのような仕組みで処理同士が連携を取って動作しているのかを見ていきましょう。

先ほどのgulpのタスクの例では、既にモジュール化された処理を`pipe`で繋げただけであるため、
それぞれの処理がどのように実装されているかはよく分かりませんでした。

ここでは`gulp-prefixer`という、それぞれのファイルに対して先頭に特定の文字列を追加するgulpプラグインを書いていきます。

同様の名前のプラグインが公式のドキュメントで「プラグインの書き方」の例として紹介されているので合わせて見ると良いでしょう。

- [gulp/docs/writing-a-plugin](https://github.com/gulpjs/gulp/tree/master/docs/writing-a-plugin "gulp/docs/writing-a-plugin at master · gulpjs/gulp")
- [gulp/dealing-with-streams.md](https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/dealing-with-streams.md "gulp/dealing-with-streams.md at master · gulpjs/gulp")

多くのgulpプラグインはオプションを受け取り、NodeのStreamを返す関数として実装されます。

[import gulp-prefixer.js](../../src/gulp/gulp-prefixer.js)

ここで実装した`gulp-prefixer`は、gulpのタスクで次のように書くことで利用できます。

[import gulpfile.babel.js](../../src/gulp/gulpfile.babel.js)

この`default`タスクは次のような処理が行われます。

1. `./*.*`にマッチするファイルを取得(全てのファイル)
2. 取得したファイルの先頭に"prefix text"という文字列を追加する
3. 変更したファイルを`build/`ディレクトリに出力する

### Stream

[gulp-prefixer.js](#gulp-prefixer.js)を見てみると、`gulpPrefixer`という[Transform Stream](https://nodejs.org/api/stream.html#stream_class_stream_transform "stream.Transform")のインスタンスを返していることが分かります。

Transform Streamというものが出てきましたが、Node.jsのStreamは次の4種類があります。

- Readable Stream
- Transform Stream
- Writable Stream
- Duplex Stream

今回の`default`タスクの処理をそれぞれ当てはめると次のようになっています。

1. `./*.*`にマッチするファイルを取得 = Readable Stream
2. 取得したファイルの先頭に"prefix text"という文字列を追加する = Transform Stream
3. 変更したファイルを`build/`ディレクトリに出力する = Writable Stream

あるファイルを _Read_ して、 _Transform_ したものを、別のところに _Write_ としているというよくあるデータの流れと言えます。

[gulp-prefixer.js](#gulp-prefixer.js)では、gulpから流れてきたデータをStreamで受け取り、
そのデータを変更したもの次へ渡すTransform Streamとなっています。

「gulpから流れてきたデータ」を扱うために`readableObjectMode`と`writableObjectMode`をそれぞれ`true`にしています。
この _ObjectMode_ というのは名前の通り、Streamでオブジェクトを流すための設定です。

通常のNode.js Streamは[Buffer](https://nodejs.org/api/buffer.html "Buffer")というバイナリデータを扱います。
この[Buffer](https://nodejs.org/api/buffer.html "Buffer")はStringと相互変換が可能ですが、複数の値を持ったオブジェクトのようなものは扱えません。

そのため、Node.js Streamには[Object Mode](https://nodejs.org/api/stream.html#stream_object_mode "Object Mode")があり、これが有効の場合はBufferやString以外のJavaScriptオブジェクトをStreamで流せるようになっています。

### vinyl

gulpでは[vinyl](https://github.com/gulpjs/vinyl "vinyl")オブジェクトがStreamで流れてきます。
このvinylは _Virtual file format_ という呼ばれているもので、ファイル情報と中身をラップしたgulp用の作成された抽象フォーマットです。

なぜこういった抽象フォーマットが必要なのかは次のことを考えてみると分かりやすいと思います。

`gulp.src`で読み込んだファイルの中身のみが、Transform Streamに渡されてしまうと、
Transform Streamからはそのファイルのパスや読み取り属性などの詳細な情報を知ることができません。

そのため、`gulp.src`で読み込んだファイルはvinylでラップされ、ファイルの中身は`contents`として参照できるようになっています。

### vinylの中身を処理する

先ほどのTransform Streamの中身を見てみましょう。

```js
// file は `vinyl` オブジェクト
if (file.isBuffer()) {
    file.contents = prefixBuffer(file.contents, prefix);
}

if (file.isStream()) {
    file.contents = file.contents.pipe(prefixStream(prefix));
}
```

`vinyl`抽象フォーマットの`contents`プロパティには、読み込んだファイルのBufferまたはStreamが格納されています。
そのため両方のパターンに対応したコードする場合はどちらが来ても問題ないように書く必要があります。

> **NOTE**: gulp pluginは必ずしも両方のパターンに対応しないといけないのではなく、Bufferだけに対応したものも多いです。しかし、その場合にStreamが来た時のErrorイベントを通知することがガイドラインで推奨されています。 - [gulp/guidelines.md at master · gulpjs/gulp](https://github.com/gulpjs/gulp/blob/master/docs/writing-a-plugin/guidelines.md "gulp/guidelines.md at master · gulpjs/gulp")

`contents`にどちらのタイプが格納されているかは、ひとつ前のStreamで決定されます。

```js
gulp.src("./*.*")
    .pipe(gulpPrefixer("prefix text"))
    .pipe(gulp.dest("build"));
```

この場合は、`gulp.src`により決定されます。
`gulp.src`はデフォルトでは、`contents`にBufferを格納するので、この場合はBufferで処理されることになります。

`gulp.src`はオプションに`{ buffer: false }`を渡すことで`contents`にStreamを流すことも可能です。

```js
gulp.src("./*.*", { buffer: false })
        .pipe(gulpPrefixer("prefix text"))
        .pipe(gulp.dest("build"));
```

### 変換処理

最後にBufferとStreamのそれぞれの変換処理を見てみます。

```js
export function prefixBuffer(buffer, prefix) {
    return Buffer.concat([Buffer(prefix), buffer]);
}

export function prefixStream(prefix) {
    return new Transform({
        transform: function (chunk, encoding, next) {
            // chunkにはBufferが流れてくる
            let buffer = prefixBuffer(chunk, prefix);
            this.push(buffer);
            next();
        }
    });
}
```

やってみたBufferの先頭に`prefix`の文字列をBufferとして結合して返すだけの処理が行われています。

この変換処理自体は、gulpに依存したものはないため、通常のライブラリに渡して処理するということが可能です。
BufferはStringと相互変換が可能であるため、多くのgulpプラグインと呼ばれるものは、`gulpPrefixer`と`prefixBuffer`にあたる部分だけを実装しています。

つまり、prefixを付けるといった変換処理自体は、既存のライブラリで行うことができるようになっています。


- [ ] どういう用途に向いている?
- [ ] どういう用途に向いていない?
- [ ] この仕組みを使っているもの
- [ ] 実装してみよう
- [ ] エコシステム

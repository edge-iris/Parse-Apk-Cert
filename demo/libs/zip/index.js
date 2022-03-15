const JSZip = require( "./jszip.min.js" )
const yaml = require( './js-yaml.min.js' )
class ZipClent {

  reg = /\r?\n/

  static get it () {
    return new ZipClent()
  }
  // https://stuk.github.io/jszip/documentation/api_zipobject/async.html

  async readApkFile ( file, parseIcon = false ) {

    const jszip = new JSZip()
    const zip = await jszip.loadAsync( file )
    let size = 0

    return new Promise( async ( resolve ) => {

      let certBase64
      let iconFile
      let iconBase64

      for ( let key in zip.files ) { // 循环遍历文件夹下的文件
        const targetFile = zip.files[ key ]

        if ( targetFile.dir ) continue

        const name = targetFile.name
        // 解析签名证书
        if ( name.toLocaleLowerCase().endsWith( '.RSA'.toLocaleLowerCase() ) ) {
          certBase64 = await targetFile.async( 'base64' )
        }

        // 解析icon
        if ( parseIcon && name.indexOf( 'ic_launcher' ) > -1 && name.endsWith( '.png' ) ) {
          const { _data: { compressedSize } } = targetFile
          if ( compressedSize > size ) {
            size = compressedSize
            iconFile = targetFile
          }
        }
      }//for

      if ( iconFile ) iconBase64 = await iconFile.async( 'base64' )
      resolve( { certBase64, iconBase64: `data:image/png;base64,${ iconBase64 }` } )
    } )
  }

  arrayBufferToString ( buffer ) {

    var bufView = new Uint16Array( buffer )
    var length = bufView.length
    var result = ''
    var addition = Math.pow( 2, 16 ) - 1

    for ( var i = 0; i < length; i += addition ) {

      if ( i + addition > length ) {
        addition = length - i
      }
      result += String.fromCharCode.apply( null, bufView.subarray( i, i + addition ) )
    }

    return result

  }

  /**
   * 
   * @param {File} file zip文件
   * @param {(text:string)=>void ?} callback 回调进度信息
   * @return 解析信息
   */
  async readZipFile ( file, callback = () => { } ) {

    console.log( '❎读取zip文件' )
    const jszip = new JSZip()
    callback && callback( "开始解析zip文件..." )
    const zip = await jszip.loadAsync( file )
    console.log( '✅读取zip文件', zip.files )
    const fileTarget = zip.files[ 'META-INF/com/google/android/updater-script' ]
    if ( !fileTarget ) return new Error( 'parse error' )
    const result = await fileTarget.async( 'string' )
    //解析 updater-script 内容转成json对象
    const object = this.parseScript2Json( result )
    // object.otaMD5 = md5
    object.appSize = file.size
    // P5 rom的逻辑
    const extend = await this.generateExtend( zip )
    if ( extend ) object.extend = extend

    callback && callback( "解析zip文件成功..." )

    console.log( '✅本地解析zip包信息', object )

    callback && callback( "开始校验zip文件..." )

    // callback && callback( "校验zip文件文件失败：" + info.mes
    // sage )
    // Notification( info )
    return
  }


  /**
   * 如果是p5的设备 rom 
   * @param {Zip} zip 
   * @returns 
   */
  async generateExtend ( zip ) {
    // 包含 payload_properties.txt文件；
    let fileTarget = zip.files[ 'payload_properties.txt' ]
    if ( !fileTarget ) return
    const extra = await fileTarget.async( 'string' )
    const headers = extra.split( this.reg ).filter( i => !!i )
    const extend = { headers }
    // 处理 payload.bin
    fileTarget = zip.files[ 'payload.bin' ]
    if ( !fileTarget ) return extend
    const { _data: { compressedContent: { byteOffset, byteLength } } } = fileTarget
    extend.payloadSize = byteLength
    extend.offset = byteOffset
    return extend
  }


  /**
   * 解析 updater-script 内容转成json对象
   * @param {string} script 
   * @returns 
   */
  parseScript2Json ( script ) {
    return Object
      .fromEntries( new URLSearchParams( script.split( this.reg )
        .filter( i => !!i )
        .filter( i => i.startsWith( '# ' ) )
        .map( i => i.slice( 2 ) )
        .join( '&' ) )
        .entries() )
  }

}




function file2json ( file ) {
  return new Promise( resolve => {
    let reader = new FileReader()
    reader.readAsText( file )
    reader.onload = function () {
      console.log( reader.result )
      resolve( reader.result )
    }
    reader.onerror = function () {
      console.log( reader.error )
    }
  } )
}
const ZipClent = require( '../zip/index.js' )


const AppInfoParser = require( './app-info-parser.min.js' )


class ApkParser {

  static get it () {
    return new ApkParser()
  }







  /**
   * 解析apk文件    
   * @param {File} file 需要解析的apk对象
   * @returns Promise<{packageName: string,
          versionCode: number,
          versionName: string,
          appIconUrl: string,
          appLabel: string,
          appSize:number}>
   */
  async do ( file ) {
    const timeLogLabel = `解析${ ( file.size / 1024 / 1024 ).toFixed( 3 ) }M 大小的apk耗时`
    console.time( timeLogLabel )
    const parser = new AppInfoParser( file ) // or xxx.ipa
    return parser.parse().then( async ( result, reject ) => {

      console.timeEnd( timeLogLabel )

      console.log( 'apk icon===>', !!result.icon )

      const { certBase64, iconBase64 } = await ZipClent.it.readApkFile( file, !result.icon )

      if ( !certBase64 ) {
        message.warning( '未签名应用' )
        return
      }


      let label = result.application.label
      // const appName = this.parseAppName( label )
      const appType = this.parseAppType( result )

      const apkInfo = {
        packageName: result.package,
        versionNumber: result.versionCode,
        versionName: result.versionName,
        appName: label,
        appSize: parser.file.size,
        appType,
        certBase64,
      }

      //  sometimes the icon can not get
      if ( result.icon || iconBase64 ) {
        const iconFile = await dataURLtoFile( result.icon ?? iconBase64, `${ label }.png` )

        // console.log( result.icon, iconFile.size )

        // 上传icon图片
        // const { url } = await OSSClient.it.uploadFile( iconFile )
        apkInfo.iconFile = iconFile
      }

      return apkInfo
    } ).catch( err => {
      console.log( 'err ----> ', err )
      message.error( err )
    } )
  }






  /**
   * 解析应用apptype
   * 包名是这个
wiseasy.com.market         appType=3
cn.wiseasy.leopardclaw    appType=1
ManifestXml文件里面节点名是android:permission的值是android.permission.BIND_INPUT_METHOD的就是输入法 appType=5
节点名是activity的孙节点的属性的第一个节点值是android.intent.category.HOME的属性的第一个节点值是android.intent.category.DEFAULT的appType=4
   * 
   * 1.dms;2应用app;3appMarket;4Launcher;5:inputMethod
   * 
   */
  parseAppType ( apkparserInfo ) {
    console.log( 'apkparserInfo>>', apkparserInfo )
    const { package: appPackage, application: { activities, services } } = apkparserInfo
    // 应用市场
    if ( 'wiseasy.com.market' === appPackage ) return 3
    // dms
    if ( 'cn.wiseasy.leopardclaw' === appPackage ) return 1

    // 输入法
    if ( services.length > 0 ) {
      const permission = services.findIndex( i => i.permission === "android.permission.BIND_INPUT_METHOD" )
      if ( permission > -1 ) {
        return 5
      }
    }
    //  桌面启动器
    if ( activities.length > 0 && activities[ 0 ].intentFilters.length > 0 ) {
      const { categories } = activities[ 0 ].intentFilters[ 0 ]
      const tempCategories = categories.map( i => i.name )
      const homeIndex = tempCategories.indexOf( 'android.intent.category.HOME' )
      const defaultIndex = tempCategories.indexOf( 'android.intent.category.DEFAULT' )
      if ( homeIndex > -1 && defaultIndex > -1 )
        return 4
    }
    return 2
  }

}

/**
 * base64 转流 再转 文件
 * @param {base64} url base64格式的图片内容
 * @param {string} filename 文件名称
 */
function dataURLtoFile ( url, filename ) {
  return fetch( url )
    .then( res => res.blob() )
    .then( blob => {
      const file = new File( [ blob ], filename, { type: "image/png" } )
      return file
    } )
}

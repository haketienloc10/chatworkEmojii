$(document).ready(function () {
    let images = [];

    $("img.sc-cvBxsj").each(function () {
        let url = $(this).attr("src");

        // Chỉ lấy URL đúng cấu trúc
        let match = url.match(/^gateway\/download_file\.php\?bin=1&file_id=(\d+)&preview=1$/);
        
        if (match) {
            let fileId = match[1]; // Lấy file_id từ URL
            let id = `[preview id=${fileId} ht=150]`;

            images.push({ url: url, id: id });
        }
    });

    console.log(images); // Xuất kết quả ra console
});

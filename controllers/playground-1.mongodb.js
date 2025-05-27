

use("injuve")
db.getCollection("bss")
.aggregate([
    {
        $group: {
            _id: "$banco",
            total: { $sum: "$importe_new" }
        }
    },
    {
        $sort: { total: -1 }
    }
])
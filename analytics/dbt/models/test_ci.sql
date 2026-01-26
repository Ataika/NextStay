SELECT * FROM {{ source('public', 'non_existent_table' }} -- пропущена закрывающая скобка )

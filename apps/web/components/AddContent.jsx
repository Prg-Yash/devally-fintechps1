import React from 'react'

import { addDataHandler } from '@/actions/post';

const AddContent = () => {
    return (
        <div>
            <button onClick={addDataHandler}>Add Sample Post</button>
        </div>
    )
}

export default AddContent